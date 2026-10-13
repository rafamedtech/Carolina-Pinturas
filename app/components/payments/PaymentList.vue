<script setup lang="ts">
import { tableQueryField, tableQueryText, tableQueryPage, tableQueryRange } from '~/utils/tableQuery'
import type { OrderDateRange } from '~/types/orders'
import type { PaymentListItem, PaymentListResponse } from '~/types/payments'
import type { CsvColumn } from '~/utils/csv'
import { paymentMethodLabel } from '~/utils/orderPayment'

const filter = shallowRef('')
const paymentMethod = shallowRef('all')
const dateRange = shallowRef<OrderDateRange | null>(null)
const page = shallowRef(1)
const pageSize = 25
const isHydrated = shallowRef(false)

onMounted(() => {
  isHydrated.value = true
})

const { returnTo } = useTableQuery([
  tableQueryField('search', filter, tableQueryText()),
  tableQueryField('payment_method', paymentMethod, tableQueryText('all')),
  tableQueryRange(dateRange),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [filter, paymentMethod, dateRange] })

const debouncedFilter = refDebounced(filter, 300)

const dateFrom = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.start.toString()
  : undefined)
const dateTo = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.end.toString()
  : undefined)
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

const csvColumns: CsvColumn<PaymentListItem>[] = [
  { key: 'order', label: 'Pedido', value: row => row.order.number },
  { key: 'paymentDate', label: 'Fecha', value: row => formatDate(row.paymentDate) },
  { key: 'customer', label: 'Cliente', value: row => row.order.customerName },
  { key: 'paymentMethod', label: 'Método', value: row => paymentMethodLabel(row.paymentMethod) },
  { key: 'reference', label: 'Referencia', value: row => row.reference || row.siigoVoucherName || '' },
  { key: 'createdBy', label: 'Registró', value: row => row.createdBy.name },
  { key: 'amount', label: 'Monto', value: row => row.amount },
  { key: 'currencyCode', label: 'Moneda', value: row => row.currencyCode }
]

function fetchAllPayments() {
  return fetchAllPages<PaymentListItem>('/api/payments', {
    search: debouncedFilter.value || undefined,
    payment_method: paymentMethod.value === 'all' ? undefined : paymentMethod.value,
    date_from: dateFrom.value,
    date_to: dateTo.value
  })
}
</script>

<template>
  <UDashboardPanel id="payments">
    <template #header>
      <UDashboardNavbar title="Pagos recibidos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <AppCsvExportButton
            filename="pagos"
            :columns="csvColumns"
            :fetch-all="fetchAllPayments"
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
