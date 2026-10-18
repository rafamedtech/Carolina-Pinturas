<script setup lang="ts">
import { tableQueryField, tableQueryText, tableQueryPage, tableQueryDate } from '~/utils/tableQuery'
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { SiigoProduct } from '~/types/siigo'
import type { CsvColumn } from '~/utils/csv'
import { canManageProducts } from '~/utils/roleAccess'

useSeoMeta({ title: 'Productos' })

const filter = ref('')
const page = ref(1)
const pageSize = 25
const router = useRouter()

const { user } = useAuth()
const filters = ref<Record<string, string>>({ active: 'true' })
const dateFilterKeys = ['created_start', 'created_end', 'updated_start', 'updated_end'] as const
const { returnTo } = useTableQuery([
  tableQueryField('search', filter, tableQueryText()),
  {
    read: (query) => {
      const value: Record<string, string> = { active: tableQueryText('true', ['true', 'false', 'all']).parse(query.active) }
      for (const key of dateFilterKeys) {
        const date = tableQueryDate.parse(query[key])
        if (date) value[key] = date
      }
      if (JSON.stringify(filters.value) !== JSON.stringify(value)) filters.value = value
    },
    write: () => ({
      active: filters.value.active === 'true' ? undefined : filters.value.active,
      ...Object.fromEntries(dateFilterKeys.map(key => [key, filters.value[key] || undefined]))
    })
  },
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [filter, filters] })
const { data, status, error, refresh } = useProductManagementCatalog(filters)
function applyFilters(value: Record<string, string>) {
  filters.value = value
  page.value = 1
}

const isHydrated = shallowRef(false)
onMounted(() => {
  isHydrated.value = true
  void reload()
})
const loading = computed(() => isHydrated.value && status.value === 'pending')

const catalog = computed(() => data.value?.results || [])
const normalizedFilter = computed(() => filter.value.trim().toLocaleLowerCase())
const filteredProducts = computed(() => {
  if (!normalizedFilter.value) return catalog.value

  return catalog.value.filter(product =>
    `${product.code} ${product.name}`.toLocaleLowerCase().includes(normalizedFilter.value)
  )
})
const products = computed(() => {
  const offset = (page.value - 1) * pageSize
  return filteredProducts.value.slice(offset, offset + pageSize)
})

// El listado masivo de Siigo no trae el nombre de la unidad (`unit: {}`);
// solo el detalle por producto lo incluye. Se resuelve por página visible.
const unitsById = reactive(new Map<string, string>())
watch(products, async (rows, _, onCleanup) => {
  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })
  const pending = rows.filter(row => !unitsById.has(row.id))
  // Four workers maximum; server deduplicates concurrent detail requests.
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (pending.length && !cancelled) {
      const row = pending.shift()!
      const detail = await $fetch<SiigoProduct>(`/api/siigo/products/${encodeURIComponent(row.id)}`).catch(() => null)
      if (!cancelled && detail) unitsById.set(row.id, siigoProductUnit(detail) || '—')
    }
  }))
}, { immediate: true })
async function reload() {
  unitsById.clear()
  await refresh()
}

function formatProductPrice(product: SiigoProduct) {
  const priceList = product.prices?.find(price => price.price_list?.some(item => item.position === 1)) ?? product.prices?.[0]
  const value = priceList?.price_list?.find(item => item.position === 1)?.value
    ?? priceList?.price_list?.[0]?.value

  if (value === undefined || value === null) return '—'

  const amount = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(amount)) return '—'

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: priceList?.currency_code || 'MXN'
  }).format(amount)
}

const csvColumns: CsvColumn<SiigoProduct>[] = [
  { key: 'code', label: 'Código' },
  { key: 'name', label: 'Producto' },
  { key: 'unit', label: 'Unidad', value: row => unitsById.get(row.id) ?? '' },
  { key: 'brand', label: 'Marca', value: row => row.additional_fields?.brand || '' },
  { key: 'account_group', label: 'Grupo', value: row => row.account_group?.name || '' },
  { key: 'inventory', label: 'Disponible interno', value: row => row.internal?.composition?.kind === 'composite' ? 'Según componentes' : row.internal?.inventory?.available ?? '' },
  { key: 'price', label: 'Precio', value: row => formatProductPrice(row) }
]

const columns: TableColumn<SiigoProduct>[] = [{
  accessorKey: 'code',
  header: 'Código'
}, {
  accessorKey: 'name',
  header: 'Producto'
}, {
  id: 'brand',
  header: 'Marca',
  cell: ({ row }) => row.original.additional_fields?.brand || '—'
}, {
  id: 'account_group',
  header: 'Grupo',
  cell: ({ row }) => row.original.account_group?.name || '—'
}, {
  id: 'inventory',
  header: 'Disponible interno',
  cell: ({ row }) => row.original.internal?.composition?.kind === 'composite' ? 'Según componentes' : row.original.internal?.inventory?.available ?? '—'
}, {
  id: 'price',
  header: 'Precio',
  cell: ({ row }) => h('span', { class: 'text-primary' }, formatProductPrice(row.original))
}]

const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el catálogo.')
const totalProducts = computed(() => filteredProducts.value.length)
const firstProduct = computed(() => totalProducts.value ? ((page.value - 1) * pageSize) + 1 : 0)
const lastProduct = computed(() => Math.min(page.value * pageSize, totalProducts.value))

function openProduct(_: Event, row: TableRow<SiigoProduct>) {
  router.push({ path: `/productos/${encodeURIComponent(row.original.id)}`, query: { returnTo: returnTo.value } })
}
</script>

<template>
  <UDashboardPanel id="products">
    <template #header>
      <UDashboardNavbar title="Productos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UInput
          v-model="filter"
          icon="i-lucide-search"
          placeholder="Buscar en todos los productos"
          class="w-full sm:max-w-sm"
        />
        <div class="flex gap-2">
          <AppCsvExportButton
            filename="productos"
            :columns="csvColumns"
            :rows="filteredProducts"
            :disabled="loading"
          />
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="loading"
            @click="reload"
          />
          <UButton
            v-if="canManageProducts(user?.role)"
            :to="{ path: '/productos/nuevo', query: { returnTo } }"
            label="Nuevo producto"
            icon="i-lucide-plus"
          />
        </div>
      </div>

      <ProductsProductFilters :filters="filters" @change="applyFilters" />

      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Catálogo no disponible"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <template v-else>
        <ProductsProductListCards
          :products="products"
          :return-to="returnTo"
          :loading="loading"
          :unit-for="(product) => unitsById.get(product.id) ?? '…'"
          :price-for="formatProductPrice"
        />

        <div
          v-if="loading"
          class="hidden shrink-0 flex-col items-center justify-center gap-3 py-16 md:flex"
          role="status"
          aria-busy="true"
        >
          <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
          <p class="text-sm text-muted">
            Cargando
          </p>
          <span class="sr-only">Cargando productos…</span>
        </div>

        <UTable
          v-else
          :data="products"
          :columns="columns"
          empty="No hay productos para mostrar."
          class="hidden shrink-0 md:block"
          :meta="{ class: { tr: 'cursor-pointer transition-colors hover:bg-elevated/50' } }"
          :ui="{
            base: 'table-fixed border-separate border-spacing-0',
            thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
            tbody: '[&>tr]:last:[&>td]:border-b-0',
            th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
            td: 'border-b border-default',
            separator: 'h-0'
          }"
          @select="openProduct"
        />
      </template>

      <div
        v-if="!error && totalProducts > 0"
        class="mt-auto flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-sm text-muted">
          Mostrando {{ firstProduct }}–{{ lastProduct }} de {{ totalProducts }} productos
        </p>

        <UPagination
          v-model:page="page"
          :total="totalProducts"
          :items-per-page="pageSize"
          :disabled="loading"
          show-edges
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
