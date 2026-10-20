<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import { ORDER_PAYMENT_METHODS, paymentMethodLabel } from '~/utils/orderPayment'
import { tableQueryField, tableQueryText, tableQueryPage, tableQueryRange } from '~/utils/tableQuery'
import type { OrderDateRange } from '~/types/orders'
import type { PaymentListItem, PaymentListResponse } from '~/types/payments'
import type { CsvColumn } from '~/utils/csv'

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
const { columns, sorting } = usePaymentListTable({ returnTo })
const filterValues = useListFilterBindings({ paymentMethod })
const listConfig: ListLayoutConfig = {
  id: 'payments', title: 'Pagos recibidos', empty: 'No hay pagos para mostrar.',
  search: { placeholder: 'Buscar pedido, cliente o referencia' }, dateFilter: { subject: 'pagos' },
  filters: [{ key: 'paymentMethod', label: 'Método de pago', type: 'select', defaultValue: 'all', items: [
    { label: 'Todos los métodos', value: 'all' }, ...ORDER_PAYMENT_METHODS.map(item => ({ label: item.label, value: item.key }))
  ] }],
  pagination: { mode: 'server', label: 'pagos', totalLabel: 'Total recibido:', pageSize }
}
</script>

<template>
  <ListLayout
    v-model:search="filter"
    v-model:date-range="dateRange"
    v-model:filters="filterValues"
    v-model:page="page"
    v-model:sorting="sorting"
    :config="listConfig"
    :data="payments.results"
    :columns="columns"
    :loading="loading"
    :error="Boolean(error)"
    error-title="Pagos no disponibles"
    :error-message="errorMessage"
    :total-results="payments.pagination.totalResults"
    :filtered-total="payments.filteredTotal"
    @refresh="refresh()"
  >
    <template #actions>
      <AppCsvExportButton
        filename="pagos"
        :columns="csvColumns"
        :fetch-all="fetchAllPayments"
        :disabled="loading"
      />
    </template>
    <template #mobile>
      <PaymentsPaymentListCards :payments="payments.results" :return-to="returnTo" />
    </template>
  </ListLayout>
</template>
