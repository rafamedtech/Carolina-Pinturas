<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ListLayoutConfig } from '~/types/list'
import { tableQueryField, tableQueryText, tableQueryPage, tableQueryRange, tableQueryBoolean } from '~/utils/tableQuery'
import type { OrderDateRange, OrderStatus, SalesOrderListItem, SalesOrderListResponse } from '~/types/orders'
import type { CsvColumn } from '~/utils/csv'
import { ORDER_PAYMENT_METHODS, paymentStatusLabel } from '~/utils/orderPayment'
import { canCreateOrders } from '~/utils/roleAccess'

const props = withDefaults(defineProps<{
  title?: string
  igualacion?: boolean
}>(), {
  title: 'Pedidos',
  igualacion: false
})

const route = useRoute()
const { user } = useAuth()
const ORDER_VIEW_KEYS = [
  'all',
  'cotizacion',
  'mostrador',
  'vendedor',
  'pendiente_pago',
  'entregado',
  'facturacion',
  'cancelado',
  'internos'
] as const
const IGUALACION_VIEW_KEYS = ['mostrador', 'vendedor']
const canViewInternal = computed(() => user.value?.role === 'admin')
function selectionFromQuery(query: typeof route.query) {
  const queryValue = (value: unknown) => typeof value === 'string' ? value : ''
  return props.igualacion
    ? IGUALACION_VIEW_KEYS.includes(queryValue(query.view))
      ? queryValue(query.view)
      : queryValue(query.status) || 'all'
    : ORDER_VIEW_KEYS.includes(queryValue(query.view) as typeof ORDER_VIEW_KEYS[number])
      && (queryValue(query.view) !== 'internos' || canViewInternal.value)
      ? queryValue(query.view)
      : 'all'
}
const filter = shallowRef('')
const selectedTab = shallowRef(selectionFromQuery(route.query))
const isInternalCustomersView = computed(() => !props.igualacion && selectedTab.value === 'internos')
const selectedStatus = computed(() =>
  props.igualacion && selectedTab.value !== 'all' && !IGUALACION_VIEW_KEYS.includes(selectedTab.value)
    ? selectedTab.value
    : undefined
)
const selectedView = computed(() =>
  selectedTab.value !== 'all'
  && !isInternalCustomersView.value
  && (!props.igualacion || IGUALACION_VIEW_KEYS.includes(selectedTab.value))
    ? selectedTab.value
    : undefined
)
const selectedQueryView = computed(() => isInternalCustomersView.value ? 'internos' : selectedView.value)
const paymentStatusKey = shallowRef('all')
const paymentMethodKey = shallowRef('all')
const hideCancelled = shallowRef(false)
const hideQuotes = shallowRef(false)
const dateRange = shallowRef<OrderDateRange | null>(null)
const page = shallowRef(1)
const pageSize = 25
const canCreate = computed(() => Boolean(user.value && canCreateOrders(user.value.role)))
const isHydrated = shallowRef(false)
const customerManagerOpen = shallowRef(false)

onMounted(() => {
  isHydrated.value = true
})

const { returnTo } = useTableQuery([
  tableQueryField('search', filter, tableQueryText()),
  {
    read: (query) => { selectedTab.value = selectionFromQuery(query) },
    write: () => ({ status: selectedStatus.value, view: selectedQueryView.value })
  },
  tableQueryField('payment_status', paymentStatusKey, tableQueryText('all')),
  tableQueryField('payment_method', paymentMethodKey, tableQueryText('all')),
  tableQueryField('hide_cancelled', hideCancelled, tableQueryBoolean),
  tableQueryField('hide_quotes', hideQuotes, tableQueryBoolean),
  tableQueryRange(dateRange),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [filter, selectedTab, paymentStatusKey, paymentMethodKey, hideCancelled, hideQuotes, dateRange] })

watch(canViewInternal, (canView) => {
  if (!canView && selectedTab.value === 'internos') selectedTab.value = 'all'
})

const debouncedFilter = refDebounced(filter, 300)

const dateFrom = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.start.toString()
  : undefined)
const dateTo = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.end.toString()
  : undefined)
const {
  data: orders,
  status,
  error,
  refresh
} = await useFetch<SalesOrderListResponse>('/api/orders', {
  lazy: true,
  query: {
    page,
    page_size: pageSize,
    search: debouncedFilter,
    status: selectedStatus,
    view: selectedView,
    payment_status: computed(() => paymentStatusKey.value === 'all' ? undefined : paymentStatusKey.value),
    payment_method: computed(() => paymentMethodKey.value === 'all' ? undefined : paymentMethodKey.value),
    hide_cancelled: computed(() => hideCancelled.value ? 'true' : undefined),
    hide_quotes: computed(() => hideQuotes.value ? 'true' : undefined),
    date_from: dateFrom,
    date_to: dateTo,
    igualacion: props.igualacion ? 'true' : undefined,
    internal_customers: computed(() => isInternalCustomersView.value ? 'true' : undefined)
  },
  default: () => ({
    results: [],
    filteredTotal: 0,
    pagination: {
      page: 1,
      pageSize,
      totalResults: 0,
      totalPages: 0
    }
  })
})
const { data: statuses } = await useFetch<OrderStatus[]>('/api/orders/statuses', {
  key: 'order-statuses',
  default: () => []
})

const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible cargar los pedidos.'
)
const loading = computed(() => isHydrated.value && status.value === 'pending')

const csvColumns = computed<CsvColumn<SalesOrderListItem>[]>(() => {
  const columns: CsvColumn<SalesOrderListItem>[] = [
    { key: 'number', label: 'Pedido' },
    { key: 'orderDate', label: 'Fecha', value: row => formatDate(row.orderDate) },
    { key: 'promisedDate', label: 'Fecha prometida', value: row => row.promisedDate ? formatDate(row.promisedDate) : '' },
    { key: 'customer', label: 'Cliente', value: row => row.customer.name },
    { key: 'rfc', label: 'RFC', value: row => row.customer.rfc ?? '' },
    { key: 'itemCount', label: 'Partidas', value: row => row.itemCount }
  ]

  if (props.igualacion) {
    columns.push({
      key: 'igualaciones',
      label: 'Igualaciones',
      value: row => (row.partidas ?? [])
        .filter(item => item.isIgualacion)
        .map(item => `${item.quantity} x ${item.code}`)
        .join(' | ')
    })
  } else {
    columns.push(
      { key: 'paymentStatus', label: 'Estado de pago', value: row => paymentStatusLabel(row.paymentStatus) },
      { key: 'total', label: 'Total', value: row => row.total }
    )
  }

  columns.push(
    { key: 'status', label: 'Estado', value: row => row.status.label },
    { key: 'createdAt', label: 'Creado', value: row => formatDateTime(row.createdAt) },
    { key: 'updatedAt', label: 'Última actualización', value: row => formatDateTime(row.updatedAt) }
  )

  if (selectedTab.value === 'facturacion') {
    columns.push({ key: 'invoiceCreated', label: 'Estado de facturación', value: row => row.invoiceCreated ? 'Facturado' : 'Sin facturar' })
  }

  return columns
})

function fetchAllOrders() {
  return fetchAllPages<SalesOrderListItem>('/api/orders', {
    search: debouncedFilter.value || undefined,
    status: selectedStatus.value,
    view: selectedView.value,
    payment_status: paymentStatusKey.value === 'all' ? undefined : paymentStatusKey.value,
    payment_method: paymentMethodKey.value === 'all' ? undefined : paymentMethodKey.value,
    hide_cancelled: hideCancelled.value ? 'true' : undefined,
    hide_quotes: hideQuotes.value ? 'true' : undefined,
    date_from: dateFrom.value,
    date_to: dateTo.value,
    igualacion: props.igualacion ? 'true' : undefined,
    internal_customers: isInternalCustomersView.value ? 'true' : undefined
  })
}

const IGUALACION_STATUS_KEYS = ['confirmado', 'surtido', 'en_espera']
const statusTabItems = computed(() => {
  if (!props.igualacion) {
    const items = [
      { label: 'Todos', value: 'all' },
      { label: 'Cotización', value: 'cotizacion' },
      { label: 'Mostrador', value: 'mostrador' },
      { label: 'Vendedor', value: 'vendedor' },
      { label: 'Pendiente de pago', value: 'pendiente_pago' },
      { label: 'Entregado', value: 'entregado' },
      { label: 'Facturación', value: 'facturacion' },
      { label: 'Cancelado', value: 'cancelado' }
    ]

    if (canViewInternal.value) items.push({ label: 'Internos', value: 'internos' })
    return items
  }

  const list = statuses.value.filter(item => IGUALACION_STATUS_KEYS.includes(item.key))
  return [{
    label: 'Todos',
    value: 'all'
  }, {
    label: 'Mostrador',
    value: 'mostrador'
  }, {
    label: 'Vendedor',
    value: 'vendedor'
  }, ...list.map(item => ({
    label: item.label,
    value: item.key
  }))]
})
const paymentStatusOptions = [{
  label: 'Todos los pagos',
  value: 'all'
}, ...PAYMENT_STATUSES.map(item => ({
  label: item.label,
  value: item.key as string
}))]

const paymentMethodOptions = [{
  label: 'Todos los métodos',
  value: 'all'
}, ...ORDER_PAYMENT_METHODS.map(item => ({
  label: item.label,
  value: item.key as string
}))]

const newOrderItems = computed<DropdownMenuItem[][]>(() => [[
  {
    label: 'Cotización',
    icon: 'i-lucide-file-text',
    to: {
      path: '/ventas/nueva-cotizacion',
      query: { returnTo: returnTo.value }
    }
  },
  {
    label: 'Venta mostrador',
    icon: 'i-lucide-store',
    to: {
      path: '/ventas/nuevo-pedido',
      query: {
        tipo: 'mostrador',
        returnTo: returnTo.value
      }
    }
  },
  {
    label: 'Venta a domicilio',
    icon: 'i-lucide-truck',
    to: {
      path: '/ventas/nuevo-pedido',
      query: {
        tipo: 'domicilio',
        returnTo: returnTo.value
      }
    }
  }
]])

const filterValues = useListFilterBindings({ paymentStatus: paymentStatusKey, paymentMethod: paymentMethodKey, hideCancelled, hideQuotes })
const { columns, sorting, columnVisibility, selectedOrder, detailOpen, openOrder } = useOrderListTable({
  returnTo,
  igualacion: props.igualacion,
  billing: () => !props.igualacion && selectedTab.value === 'facturacion'
})
const listConfig = computed<ListLayoutConfig>(() => ({
  id: props.igualacion ? 'igualaciones' : 'sales-orders', title: props.title,
  empty: props.igualacion ? 'No hay igualaciones para mostrar.' : 'No hay pedidos para mostrar.',
  search: { placeholder: 'Buscar pedido o cliente' }, dateFilter: { subject: props.igualacion ? 'igualaciones' : 'pedidos' },
  tabs: statusTabItems.value,
  filters: [
    { key: 'paymentStatus', label: 'Estado de pago', type: 'select', defaultValue: 'all', items: paymentStatusOptions },
    { key: 'paymentMethod', label: 'Método de pago', type: 'select', defaultValue: 'all', items: paymentMethodOptions },
    { key: 'hideCancelled', label: 'Ocultar cancelados', type: 'checkbox', defaultValue: false },
    { key: 'hideQuotes', label: 'Ocultar cotizaciones', type: 'checkbox', defaultValue: false }
  ],
  create: !props.igualacion && canCreate.value ? { items: newOrderItems.value } : undefined,
  pagination: { mode: 'server', label: props.igualacion ? 'igualaciones' : 'pedidos', pageSize }
}))
</script>

<template>
  <ListLayout
    v-model:search="filter"
    v-model:date-range="dateRange"
    v-model:filters="filterValues"
    v-model:tab="selectedTab"
    v-model:page="page"
    v-model:sorting="sorting"
    v-model:column-visibility="columnVisibility"
    :config="listConfig"
    :data="orders.results"
    :columns="columns"
    :loading="loading"
    :error="Boolean(error)"
    error-title="Pedidos no disponibles"
    :error-message="errorMessage"
    :total-results="orders.pagination.totalResults"
    :filtered-total="igualacion ? undefined : orders.filteredTotal"
    @refresh="refresh()"
  >
    <template #actions>
      <UButton
        v-if="isInternalCustomersView"
        label="Gestionar clientes"
        icon="i-lucide-users-round"
        color="neutral"
        variant="outline"
        :ui="{ label: 'hidden sm:inline' }"
        @click="customerManagerOpen = true"
      />
      <AppCsvExportButton
        :filename="igualacion ? 'igualaciones' : 'pedidos'"
        :columns="csvColumns"
        :fetch-all="fetchAllOrders"
        :disabled="loading"
      />
    </template>
    <template #mobile>
      <OrdersOrderListCards
        :orders="orders.results"
        :loading="false"
        :igualacion="igualacion"
        :return-to="returnTo"
        @open="openOrder"
      />
    </template>
    <template #overlays>
      <OrdersOrderListPreviewModal v-model:open="detailOpen" :order="selectedOrder" :return-to="returnTo" />
      <OrdersInternalOrderCustomersModal v-if="canViewInternal" v-model:open="customerManagerOpen" @saved="refresh()" />
    </template>
  </ListLayout>
</template>
