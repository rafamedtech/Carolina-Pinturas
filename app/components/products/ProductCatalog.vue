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
const filters = ref<Record<string, string>>({})
const showInactive = shallowRef(false)
const hideComposite = shallowRef(false)
const hideOutOfStock = shallowRef(false)
const dateFilterKeys = ['created_start', 'created_end'] as const
const { returnTo } = useTableQuery([
  tableQueryField('search', filter, tableQueryText()),
  {
    read: (query) => {
      productTab.value = tableQueryText(query.active === 'false' ? 'inactive' : 'all', productTabs).parse(query.tab)
      showInactive.value = query.show_inactive === 'true'
      hideComposite.value = query.hide_composite === 'true'
      hideOutOfStock.value = query.hide_out_of_stock === 'true'
      const value: Record<string, string> = {}
      for (const key of dateFilterKeys) {
        const date = tableQueryDate.parse(query[key])
        if (date) value[key] = date
      }
      if (JSON.stringify(filters.value) !== JSON.stringify(value)) filters.value = value
    },
    write: () => ({
      tab: productTab.value === 'all' ? undefined : productTab.value,
      active: undefined,
      show_inactive: showInactive.value ? 'true' : undefined,
      hide_composite: hideComposite.value ? 'true' : undefined,
      hide_out_of_stock: hideOutOfStock.value ? 'true' : undefined,
      updated_start: undefined,
      updated_end: undefined,
      ...Object.fromEntries(dateFilterKeys.map(key => [key, filters.value[key] || undefined]))
    })
  },
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [filter, filters, productTab, showInactive, hideComposite, hideOutOfStock] })
const catalogFilters = computed(() => ({
  ...filters.value,
  active: productTab.value === 'inactive' ? 'false' : showInactive.value ? 'all' : 'true'
}))
const { data, status, error, refresh } = useProductManagementCatalog(catalogFilters)
function applyFilters(value: Record<string, string>) {
  filters.value = Object.fromEntries(Object.entries(value).filter(([, entry]) => Boolean(entry)))
  page.value = 1
}

const loading = computed(() => status.value === 'idle' || status.value === 'pending')

// Apply the exclusion before search, pagination, totals and CSV export.
const catalog = computed(() => (data.value?.results ?? []).filter((product) => {
  if (product.account_group?.name?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-MX') === 'servicios gravados') return false
  if (hideComposite.value && product.internal?.composition?.kind === 'composite') return false
  // Unknown stock (including composites) is not a confirmed zero balance.
  const available = product.internal?.inventory?.available
  if (hideOutOfStock.value && available != null && Number(available) <= 0) return false
  if (productTab.value === 'inactive') return product.active === false
  if (!showInactive.value && product.active === false) return false
  if (productTab.value === 'all') return true
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
  { key: 'unit', label: 'Unidad', value: row => siigoProductUnit(row) },
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
  page.value = 1
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
  get: () => ({
    show_inactive: showInactive.value,
    hide_composite: hideComposite.value,
    hide_out_of_stock: hideOutOfStock.value
  }),
  set: (value) => {
    showInactive.value = value.show_inactive === true
    hideComposite.value = value.hide_composite === true
    hideOutOfStock.value = value.hide_out_of_stock === true
    page.value = 1
  }
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
    { key: 'show_inactive', label: 'Mostrar inactivos', type: 'checkbox', defaultValue: false },
    { key: 'hide_composite', label: 'Ocultar compuestos', type: 'checkbox', defaultValue: false },
    { key: 'hide_out_of_stock', label: 'Ocultar sin existencias', type: 'checkbox', defaultValue: false }
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
    @refresh="refresh"
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
        :unit-for="(product) => siigoProductUnit(product) || '—'"
        :price-for="formatProductPrice"
      />
    </template>
  </ListLayout>
</template>
