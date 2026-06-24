<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { SiigoProduct } from '~/types/siigo'

const filter = ref('')
const page = ref(1)
const pageSize = 25

watch(filter, () => {
  page.value = 1
})

const { data, status, error, refresh } = useProductsCatalog()

await callOnce('products-catalog', refresh)

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

function formatProductPrice(product: SiigoProduct) {
  const priceList = product.prices?.find(price => price.price_list?.some(item => item.position === 1)) ?? product.prices?.[0]
  const value = priceList?.price_list?.find(item => item.position === 1)?.value
    ?? priceList?.price_list?.[0]?.value
    ?? product.price

  if (value === undefined || value === null) return '—'

  const amount = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(amount)) return '—'

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: priceList?.currency_code || 'MXN'
  }).format(amount)
}

const columns: TableColumn<SiigoProduct>[] = [{
  accessorKey: 'code',
  header: 'Código'
}, {
  accessorKey: 'name',
  header: 'Producto'
}, {
  accessorKey: 'type',
  header: 'Tipo',
  cell: ({ row }) => row.getValue('type') || 'Producto'
}, {
  accessorKey: 'stock_control',
  header: 'Inventario',
  cell: ({ row }) => row.getValue('stock_control') ? 'Controlado' : 'Sin control'
}, {
  accessorKey: 'available_quantity',
  header: 'Existencia',
  cell: ({ row }) => row.getValue('available_quantity') ?? '—'
}, {
  id: 'price',
  header: 'Precio',
  cell: ({ row }) => formatProductPrice(row.original)
}, {
  accessorKey: 'active',
  header: 'Estado',
  cell: ({ row }) => row.getValue('active') === false ? 'Inactivo' : 'Activo'
}]

const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el catálogo.')
const totalProducts = computed(() => filteredProducts.value.length)
const firstProduct = computed(() => totalProducts.value ? ((page.value - 1) * pageSize) + 1 : 0)
const lastProduct = computed(() => Math.min(page.value * pageSize, totalProducts.value))
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
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="status === 'pending'"
            @click="() => refresh()"
          />
          <UButton
            label="Nuevo producto"
            icon="i-lucide-plus"
            disabled
            title="Se habilita tras validar la API de Siigo México."
          />
        </div>
      </div>

      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Catálogo no disponible"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <UTable
        v-else
        :data="products"
        :columns="columns"
        :loading="status === 'pending'"
        empty="No hay productos para mostrar."
        class="shrink-0"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      >
        <template #loading>
          <div class="flex items-center justify-center gap-2 text-muted" role="status">
            <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-primary" />
            <span>Cargando productos…</span>
          </div>
        </template>
      </UTable>

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
          :disabled="status === 'pending'"
          show-edges
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
