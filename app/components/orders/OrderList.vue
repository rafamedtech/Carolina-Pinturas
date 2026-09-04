<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { OrderDateRange, OrderStatus, SalesOrderListResponse } from '~/types/orders'
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
const ORDER_VIEW_KEYS = [
  'all',
  'cotizacion',
  'mostrador',
  'vendedor',
  'pendiente_pago',
  'entregado',
  'facturacion',
  'cancelado'
] as const
const initialSelection = props.igualacion
  ? queryValue(route.query.status) || 'all'
  : ORDER_VIEW_KEYS.includes(queryValue(route.query.view) as typeof ORDER_VIEW_KEYS[number])
    ? queryValue(route.query.view)
    : 'all'
const filter = shallowRef(queryValue(route.query.search))
const selectedTab = shallowRef(initialSelection)
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
const { user } = useAuth()
const canCreate = computed(() => Boolean(user.value && canCreateOrders(user.value.role)))
const isHydrated = shallowRef(false)

onMounted(() => {
  isHydrated.value = true
})

watch([filter, selectedTab, paymentStatusKey, paymentMethodKey, hideCancelled, hideQuotes, dateRange], () => {
  page.value = 1
})

const dateFrom = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.start.toString()
  : undefined)
const dateTo = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.end.toString()
  : undefined)
const listQuery = computed(() => ({
  ...(filter.value ? { search: filter.value } : {}),
  ...(selectedTab.value !== 'all'
    ? props.igualacion
      ? { status: selectedTab.value }
      : { view: selectedTab.value }
    : {}),
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
    status: computed(() => props.igualacion && selectedTab.value !== 'all' ? selectedTab.value : undefined),
    view: computed(() => !props.igualacion && selectedTab.value !== 'all' ? selectedTab.value : undefined),
    payment_status: computed(() => paymentStatusKey.value === 'all' ? undefined : paymentStatusKey.value),
    payment_method: computed(() => paymentMethodKey.value === 'all' ? undefined : paymentMethodKey.value),
    hide_cancelled: computed(() => hideCancelled.value ? 'true' : undefined),
    hide_quotes: computed(() => hideQuotes.value ? 'true' : undefined),
    date_from: dateFrom,
    date_to: dateTo,
    igualacion: props.igualacion ? 'true' : undefined
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

const IGUALACION_STATUS_KEYS = ['confirmado', 'surtido', 'en_espera']
const statusTabItems = computed(() => {
  if (!props.igualacion) {
    return [
      { label: 'Todos', value: 'all' },
      { label: 'Cotización', value: 'cotizacion' },
      { label: 'Mostrador', value: 'mostrador' },
      { label: 'Vendedor', value: 'vendedor' },
      { label: 'Pendiente de pago', value: 'pendiente_pago' },
      { label: 'Entregado', value: 'entregado' },
      { label: 'Facturación', value: 'facturacion' },
      { label: 'Cancelado', value: 'cancelado' }
    ]
  }

  const list = statuses.value.filter(item => IGUALACION_STATUS_KEYS.includes(item.key))
  return [{
    label: 'Todos',
    value: 'all'
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
    </template>
  </UDashboardPanel>
</template>
