<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { OrderDateRange, OrderStatus, SalesOrderListItem, SalesOrderListResponse } from '~/types/orders'
import type { CsvColumn } from '~/utils/csv'
import { paymentStatusLabel } from '~/utils/orderPayment'
import { canCreateOrders } from '~/utils/roleAccess'

const props = withDefaults(defineProps<{
  title?: string
  igualacion?: boolean
}>(), {
  title: 'Pedidos',
  igualacion: false
})

function queryValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function queryPage(value: unknown) {
  const parsedPage = Number(queryValue(value))
  return Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
}

function queryBoolean(value: unknown) {
  const normalized = queryValue(value)
  return normalized === 'true' || normalized === '1'
}

function queryDateRange(from: unknown, to: unknown): OrderDateRange | null {
  const start = queryValue(from)
  const end = queryValue(to)
  if (!start || !end) return null

  try {
    return { start: parseDate(start), end: parseDate(end) }
  } catch {
    return null
  }
}

const route = useRoute()
const router = useRouter()
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
const initialSelection = props.igualacion
  ? IGUALACION_VIEW_KEYS.includes(queryValue(route.query.view))
    ? queryValue(route.query.view)
    : queryValue(route.query.status) || 'all'
  : ORDER_VIEW_KEYS.includes(queryValue(route.query.view) as typeof ORDER_VIEW_KEYS[number])
    && (queryValue(route.query.view) !== 'internos' || canViewInternal.value)
    ? queryValue(route.query.view)
    : 'all'
const filter = shallowRef(queryValue(route.query.search))
const selectedTab = shallowRef(initialSelection)
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
const paymentStatusKey = shallowRef(queryValue(route.query.payment_status) || 'all')
const paymentMethodKey = shallowRef(queryValue(route.query.payment_method) || 'all')
const hideCancelled = shallowRef(queryBoolean(route.query.hide_cancelled))
const hideQuotes = shallowRef(queryBoolean(route.query.hide_quotes))
const dateRange = shallowRef<OrderDateRange | null>(
  queryDateRange(route.query.date_from, route.query.date_to)
)
const page = shallowRef(queryPage(route.query.page))
const pageSize = 25
const debouncedFilter = refDebounced(filter, 300)
const canCreate = computed(() => Boolean(user.value && canCreateOrders(user.value.role)))
const isHydrated = shallowRef(false)
const customerManagerOpen = shallowRef(false)

onMounted(() => {
  isHydrated.value = true
})

watch([filter, selectedTab, paymentStatusKey, paymentMethodKey, hideCancelled, hideQuotes, dateRange], () => {
  page.value = 1
})

watch(canViewInternal, (canView) => {
  if (!canView && selectedTab.value === 'internos') selectedTab.value = 'all'
})

const dateFrom = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.start.toString()
  : undefined)
const dateTo = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.end.toString()
  : undefined)
const listQuery = computed(() => ({
  ...(filter.value ? { search: filter.value } : {}),
  ...(selectedStatus.value ? { status: selectedStatus.value } : {}),
  ...(selectedQueryView.value ? { view: selectedQueryView.value } : {}),
  ...(paymentStatusKey.value !== 'all' ? { payment_status: paymentStatusKey.value } : {}),
  ...(paymentMethodKey.value !== 'all' ? { payment_method: paymentMethodKey.value } : {}),
  ...(hideCancelled.value ? { hide_cancelled: 'true' } : {}),
  ...(hideQuotes.value ? { hide_quotes: 'true' } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
  ...(page.value > 1 ? { page: String(page.value) } : {})
}))
const returnTo = computed(() => router.resolve({
  path: route.path,
  query: listQuery.value
}).fullPath)

watch(
  [debouncedFilter, selectedTab, paymentStatusKey, paymentMethodKey, hideCancelled, hideQuotes, dateFrom, dateTo, page],
  () => {
    void router.replace({ query: listQuery.value })
  }
)

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
    { key: 'orderDate', label: 'Fecha' },
    { key: 'promisedDate', label: 'Fecha prometida', value: row => row.promisedDate ?? '' },
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
    { key: 'createdAt', label: 'Creado', value: row => row.createdAt },
    { key: 'updatedAt', label: 'Última actualización', value: row => row.updatedAt }
  )

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
</script>

<template>
  <UDashboardPanel :id="igualacion ? 'igualaciones' : 'sales-orders'">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
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
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            aria-label="Actualizar"
            :ui="{ label: 'hidden sm:inline' }"
            :loading="loading"
            @click="refresh()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <OrdersOrderListToolbar
        v-model:filter="filter"
        v-model:status="selectedTab"
        v-model:payment-status="paymentStatusKey"
        v-model:payment-method="paymentMethodKey"
        v-model:hide-cancelled="hideCancelled"
        v-model:hide-quotes="hideQuotes"
        v-model:date-range="dateRange"
        :items="statusTabItems"
        :igualacion="igualacion"
        :can-create="canCreate"
        :return-to="returnTo"
      />

      <UTabs
        v-model="selectedTab"
        :items="statusTabItems"
        class="hidden w-full sm:block"
      />

      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Pedidos no disponibles"
        :description="errorMessage"
        icon="i-lucide-database-zap"
      />

      <OrdersOrderListTable
        v-else
        :orders="orders.results"
        :loading="loading"
        :igualacion="igualacion"
        :return-to="returnTo"
      />

      <OrdersOrderListPagination
        v-if="!error"
        v-model:page="page"
        :total-results="orders.pagination.totalResults"
        :filtered-total="igualacion ? undefined : orders.filteredTotal"
        :page-size="orders.pagination.pageSize"
        :loading="loading"
      />

      <OrdersInternalOrderCustomersModal
        v-if="canViewInternal"
        v-model:open="customerManagerOpen"
        @saved="refresh()"
      />
    </template>
  </UDashboardPanel>
</template>
