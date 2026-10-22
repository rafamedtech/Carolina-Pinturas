<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { OrderDateRange } from '~/types/orders'
import type { ListLayoutConfig, ListFilterValues } from '~/types/list'
import { tableQueryField, tableQueryText, tableQueryPage, tableQueryDate } from '~/utils/tableQuery'
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { SiigoProduct } from '~/types/siigo'
import type { CsvColumn } from '~/utils/csv'
import { canManageProducts } from '~/utils/roleAccess'

const filter = ref('')
const page = ref(1)
const pageSize = 25
const router = useRouter()

const { user } = useAuth()
const productTab = shallowRef('all')
const productTabs = ['all', 'purchase', 'sale', 'expense', 'composite', 'inactive']
const filters = ref<Record<string, string>>({ active: 'all' })
const dateFilterKeys = ['created_start', 'created_end', 'updated_start', 'updated_end'] as const
const { returnTo } = useTableQuery([
  tableQueryField('search', filter, tableQueryText()),
  {
    read: (query) => {
      productTab.value = tableQueryText(query.active === 'false' ? 'inactive' : 'all', productTabs).parse(query.tab)
      const value: Record<string, string> = { active: productTab.value === 'inactive' ? 'false' : productTab.value === 'all' ? 'all' : 'true' }
      for (const key of dateFilterKeys) {
        const date = tableQueryDate.parse(query[key])
        if (date) value[key] = date
      }
      if (JSON.stringify(filters.value) !== JSON.stringify(value)) filters.value = value
    },
    write: () => ({
      tab: productTab.value === 'all' ? undefined : productTab.value,
      active: undefined,
      ...Object.fromEntries(dateFilterKeys.map(key => [key, filters.value[key] || undefined]))
    })
  },
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [filter, filters, productTab] })
const { data, status, error, refresh } = useProductManagementCatalog(filters)
function applyFilters(value: Record<string, string>) {
  filters.value = Object.fromEntries(Object.entries(value).filter(([, entry]) => Boolean(entry)))
  page.value = 1
}

const isHydrated = shallowRef(false)
onMounted(() => {
  isHydrated.value = true
  void reload()
})
const loading = computed(() => isHydrated.value && status.value === 'pending')

// Apply the exclusion before search, pagination, totals and CSV export.
const catalog = computed(() => (data.value?.results ?? []).filter((product) => {
  if (product.account_group?.name?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-MX') === 'servicios gravados') return false
  if (productTab.value === 'all') return true
  if (productTab.value === 'inactive') return product.active === false
  if (product.active === false) return false
  if (productTab.value === 'composite') return product.internal?.composition?.kind === 'composite'
  return product.internal?.availability?.[productTab.value as 'purchase' | 'sale' | 'expense'] === true
}))
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
  header: 'Código',
  cell: ({ row }) => h('span', { class: 'text-primary' }, row.original.code)
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
  cell: ({ row }) => h('span', { class: 'text-primary font-semibold' }, formatProductPrice(row.original))
}]

const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el catálogo.')
const totalProducts = computed(() => filteredProducts.value.length)

function openProduct(_: Event, row: TableRow<SiigoProduct>) {
  router.push({ path: `/productos/${encodeURIComponent(row.original.id)}`, query: { returnTo: returnTo.value } })
}
function selectProductTab(tab: string) {
  productTab.value = tab
  applyFilters({ ...filters.value, active: tab === 'inactive' ? 'false' : tab === 'all' ? 'all' : 'true' })
}
const createdRange = computed<OrderDateRange | null>({
  get: () => {
    try {
      return filters.value.created_start || filters.value.created_end
        ? { start: filters.value.created_start ? parseDate(filters.value.created_start) : undefined, end: filters.value.created_end ? parseDate(filters.value.created_end) : undefined }
        : null
    } catch {
      return null
    }
  },
  set: value => applyFilters({ ...filters.value, created_start: value?.start?.toString() || '', created_end: value?.end?.toString() || '' })
})
const filterValues = computed<ListFilterValues>({
  get: () => Object.fromEntries(dateFilterKeys.map(key => [key, filters.value[key] || ''])),
  set: value => applyFilters({ ...filters.value, ...Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) })
})
const listConfig = computed<ListLayoutConfig>(() => ({
  id: 'products', title: 'Productos', empty: 'No hay productos para mostrar.',
  search: { placeholder: 'Buscar en todos los productos' }, dateFilter: { subject: 'productos creados' },
  tabs: [
    { label: 'Todos', value: 'all' },
    { label: 'Compra', value: 'purchase' },
    { label: 'Venta directa', value: 'sale' },
    { label: 'Gasto', value: 'expense' },
    { label: 'Compuestos', value: 'composite' },
    { label: 'Inactivos', value: 'inactive' }
  ], defaultTab: 'all',
  filters: [
    { key: 'created_start', label: 'Creado desde', type: 'date', defaultValue: '' },
    { key: 'created_end', label: 'Creado hasta', type: 'date', defaultValue: '' },
    { key: 'updated_start', label: 'Actualizado desde', type: 'date', defaultValue: '' },
    { key: 'updated_end', label: 'Actualizado hasta', type: 'date', defaultValue: '' }
  ],
  create: canManageProducts(user.value?.role) ? { label: 'Nuevo producto', to: { path: '/productos/nuevo', query: { returnTo: returnTo.value } } } : undefined,
  pagination: { mode: 'external', label: 'productos', pageSize }
}))
</script>

<template>
  <ListLayout
    v-model:search="filter"
    v-model:date-range="createdRange"
    v-model:filters="filterValues"
    v-model:page="page"
    :tab="productTab"
    :config="listConfig"
    :data="products"
    :columns="columns"
    :loading="loading"
    :error="Boolean(error)"
    error-title="Catálogo no disponible"
    :error-message="message"
    :total-results="totalProducts"
    @update:tab="selectProductTab"
    @refresh="reload"
    @select="openProduct"
  >
    <template #actions>
      <AppCsvExportButton
        filename="productos"
        :columns="csvColumns"
        :rows="filteredProducts"
        :disabled="loading"
      />
    </template>
    <template #mobile>
      <ProductsProductListCards
        :products="products"
        :return-to="returnTo"
        :loading="false"
        :unit-for="(product) => unitsById.get(product.id) ?? '…'"
        :price-for="formatProductPrice"
      />
    </template>
  </ListLayout>
</template>
