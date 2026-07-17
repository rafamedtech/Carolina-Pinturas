<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { OrderDateRange, OrderStatus, SalesOrderListResponse } from '~/types/orders'
import { canCreateOrders, canCustomizeOrderColumns } from '~/utils/roleAccess'

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
const filter = shallowRef(queryValue(route.query.search))
const statusKey = shallowRef(queryValue(route.query.status) || 'all')
const paymentStatusKey = shallowRef(queryValue(route.query.payment_status) || 'all')
const paymentMethodKey = shallowRef(queryValue(route.query.payment_method) || 'all')
const dateRange = shallowRef<OrderDateRange | null>(
  queryDateRange(route.query.date_from, route.query.date_to)
)
const page = shallowRef(queryPage(route.query.page))
const pageSize = 25
const debouncedFilter = refDebounced(filter, 300)
const { user } = useAuth()
const canCreate = computed(() => Boolean(user.value && canCreateOrders(user.value.role)))
const canCustomizeColumns = computed(() => Boolean(
  user.value && canCustomizeOrderColumns(user.value.role)
))
const isHydrated = shallowRef(false)

onMounted(() => {
  isHydrated.value = true
})

watch([filter, statusKey, paymentStatusKey, paymentMethodKey, dateRange], () => {
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
  ...(statusKey.value !== 'all' ? { status: statusKey.value } : {}),
  ...(paymentStatusKey.value !== 'all' ? { payment_status: paymentStatusKey.value } : {}),
  ...(paymentMethodKey.value !== 'all' ? { payment_method: paymentMethodKey.value } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
  ...(page.value > 1 ? { page: String(page.value) } : {})
}))
const returnTo = computed(() => router.resolve({
  path: route.path,
  query: listQuery.value
}).fullPath)

watch(
  [debouncedFilter, statusKey, paymentStatusKey, paymentMethodKey, dateFrom, dateTo, page],
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
    status: computed(() => statusKey.value === 'all' ? undefined : statusKey.value),
    payment_status: computed(() => paymentStatusKey.value === 'all' ? undefined : paymentStatusKey.value),
    payment_method: computed(() => paymentMethodKey.value === 'all' ? undefined : paymentMethodKey.value),
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
  const list = props.igualacion
    ? statuses.value.filter(item => IGUALACION_STATUS_KEYS.includes(item.key))
    : statuses.value
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
        v-model:status="statusKey"
        v-model:payment-status="paymentStatusKey"
        v-model:payment-method="paymentMethodKey"
        v-model:date-range="dateRange"
        :statuses="statuses"
        :igualacion="igualacion"
        :can-create="canCreate"
        :return-to="returnTo"
      />

      <UTabs
        v-model="statusKey"
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
        :can-customize-columns="canCustomizeColumns"
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
