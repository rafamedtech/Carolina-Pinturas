<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { OrderDateRange } from '~/types/orders'
import type { PaymentListResponse } from '~/types/payments'

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
const paymentMethod = shallowRef(queryValue(route.query.payment_method) || 'all')
const dateRange = shallowRef<OrderDateRange | null>(
  queryDateRange(route.query.date_from, route.query.date_to)
)
const page = shallowRef(queryPage(route.query.page))
const pageSize = 25
const debouncedFilter = refDebounced(filter, 300)
const isHydrated = shallowRef(false)

onMounted(() => {
  isHydrated.value = true
})

watch([filter, paymentMethod, dateRange], () => {
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
  ...(paymentMethod.value !== 'all' ? { payment_method: paymentMethod.value } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
  ...(page.value > 1 ? { page: String(page.value) } : {})
}))
const returnTo = computed(() => router.resolve({
  path: route.path,
  query: listQuery.value
}).fullPath)

watch([debouncedFilter, paymentMethod, dateFrom, dateTo, page], () => {
  void router.replace({ query: listQuery.value })
})

const {
  data: payments,
  status,
  error,
  refresh
} = await useFetch<PaymentListResponse>('/api/payments', {
  lazy: true,
  query: {
    page,
    page_size: pageSize,
    search: debouncedFilter,
    payment_method: computed(() => paymentMethod.value === 'all' ? undefined : paymentMethod.value),
    date_from: dateFrom,
    date_to: dateTo
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

const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible cargar los pagos.'
)
const loading = computed(() => isHydrated.value && status.value === 'pending')
</script>

<template>
  <UDashboardPanel id="payments">
    <template #header>
      <UDashboardNavbar title="Pagos recibidos">
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
      <PaymentsPaymentListToolbar
        v-model:filter="filter"
        v-model:payment-method="paymentMethod"
        v-model:date-range="dateRange"
      />

      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Pagos no disponibles"
        :description="errorMessage"
        icon="i-lucide-database-zap"
      />

      <PaymentsPaymentListTable
        v-else
        :payments="payments.results"
        :loading="loading"
        :return-to="returnTo"
      />

      <PaymentsPaymentListPagination
        v-if="!error"
        v-model:page="page"
        :total-results="payments.pagination.totalResults"
        :filtered-total="payments.filteredTotal"
        :page-size="payments.pagination.pageSize"
        :loading="loading"
      />
    </template>
  </UDashboardPanel>
</template>
