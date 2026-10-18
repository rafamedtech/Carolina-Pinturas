<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import { tableQueryField, tableQueryText, tableQueryRange, tableQuerySorting, tableQueryPage } from '~/utils/tableQuery'
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SortingState, TableMeta } from '@tanstack/table-core'
import type { OrderDateRange } from '~/types/orders'
import type { PurchaseView } from '~/types/purchases'
import type { CsvColumn } from '~/utils/csv'
import { purchaseStatus } from '~/utils/purchaseFormat'
import { formatDate, mexicoToday } from '~/utils/datetime'

const UBadge = resolveComponent('UBadge')
const NuxtLink = resolveComponent('NuxtLink')
const sorting = ref<SortingState>([])
const isHydrated = shallowRef(false)

onMounted(() => {
  isHydrated.value = true
})

const page = shallowRef(1)
const pageSize = 25
const search = shallowRef('')
const status = shallowRef('all')
const dateRange = shallowRef<OrderDateRange | null>(null)
const { returnTo } = useTableQuery([
  tableQueryField('search', search, tableQueryText()),
  tableQueryField('status', status, tableQueryText('all', ['all', 'confirmada', 'liquidada', 'vencida', 'borrador', 'cancelada'])),
  tableQueryRange(dateRange),
  tableQueryField('sort', sorting, tableQuerySorting),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [search, status, dateRange] })
const statusItems = [
  { label: 'Todas', value: 'all' },
  { label: 'Confirmada', value: 'confirmada' },
  { label: 'Liquidada', value: 'liquidada' },
  { label: 'Vencida', value: 'vencida' },
  { label: 'Borrador', value: 'borrador' },
  { label: 'Cancelada', value: 'cancelada' }
]
const query = computed(() => ({
  search: search.value || undefined,
  status: status.value === 'all' ? undefined : status.value,
  dateFrom: dateRange.value?.start && dateRange.value?.end ? dateRange.value.start.toString() : undefined,
  dateTo: dateRange.value?.start && dateRange.value?.end ? dateRange.value.end.toString() : undefined
}))
const { data, error, status: requestStatus, refresh } = await useFetch<{ results: PurchaseView[] }>('/api/purchases', {
  lazy: true,
  query
})
const loading = computed(() => requestStatus.value === 'idle' || (isHydrated.value && requestStatus.value === 'pending'))
const purchases = computed(() => [...(data.value?.results ?? [])])

function nextInvoiceDueDate(order: PurchaseView): string | undefined {
  return order.invoices.reduce<string | undefined>((dueDate, invoice) => {
    if (invoice.voidedAt || invoice.status === 'anulada' || invoice.balance <= 0) return dueDate
    return !dueDate || invoice.dueDate < dueDate ? invoice.dueDate : dueDate
  }, undefined)
}

const tableMeta: TableMeta<PurchaseView> = {
  class: {
    tr: (row) => {
      const invoices = row.original.invoices.filter(invoice => !invoice.voidedAt && invoice.status !== 'anulada')
      if (!invoices.length) return ''
      const pendingInvoices = invoices.filter(invoice => invoice.balance > 0)
      const today = mexicoToday()
      if (pendingInvoices.some(invoice => invoice.dueDate < today)) return 'bg-error/10'
      if (pendingInvoices.some(invoice => invoice.dueDate >= today)) return 'bg-warning/10'
      if (invoices.every(invoice => invoice.balance === 0)) return 'bg-success/10'
      return ''
    }
  },
  style: {
    tr: { '--ui-warning': 'var(--color-yellow-500)' }
  }
}

const csvColumns: CsvColumn<PurchaseView>[] = [
  { key: 'date', label: 'Fecha', value: row => formatDate(row.date) },
  { key: 'folio', label: 'Orden', value: row => `OC-${row.folio}` },
  { key: 'providerName', label: 'Proveedor' },
  { key: 'status', label: 'Estado' },
  { key: 'nextDueDate', label: 'Próximo vencimiento', value: row => formatDate(nextInvoiceDueDate(row)) },
  { key: 'total', label: 'Total', value: row => row.total },
  { key: 'currencyCode', label: 'Moneda' },
  { key: 'balance', label: 'Saldo pendiente', value: row => row.balance }
]

const { sortableHeader } = useListTableColumns<PurchaseView>()

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true
})

function formatAmount(amount: number, currencyCode: string, colorClass = '') {
  return h('div', { class: ['text-right font-semibold', colorClass] }, `$${amountFormatter.format(amount)} ${currencyCode}`)
}

const columns: TableColumn<PurchaseView>[] = [{
  accessorKey: 'date',
  header: sortableHeader('Fecha'),
  cell: ({ row }) => formatDate(row.original.date)
}, {
  accessorKey: 'folio',
  header: sortableHeader('Orden'),
  cell: ({ row }) => h(
    NuxtLink,
    { to: { path: `/compras/${row.original.id}`, query: { returnTo: returnTo.value } }, class: 'font-semibold text-primary underline' },
    () => `OC-${row.original.folio}`
  )
}, {
  accessorKey: 'providerName',
  header: sortableHeader('Proveedor')
}, {
  accessorKey: 'status',
  header: sortableHeader('Estado'),
  cell: ({ row }) => {
    const status = purchaseStatus(row.original.status)
    return h(UBadge, { color: status.color, icon: status.icon, variant: 'soft', ui: { leadingIcon: 'size-4' } }, () => status.label)
  }
}, {
  id: 'nextDueDate',
  accessorFn: nextInvoiceDueDate,
  header: sortableHeader('Próximo vencimiento'),
  sortUndefined: 'last',
  cell: ({ getValue }) => formatDate(getValue<string | undefined>())
}, {
  accessorKey: 'total',
  header: sortableHeader('Total', 'right'),
  cell: ({ row }) => formatAmount(row.original.total, row.original.currencyCode)
}, {
  accessorKey: 'balance',
  header: sortableHeader('Saldo pendiente', 'right'),
  cell: ({ row }) => formatAmount(
    row.original.balance,
    row.original.currencyCode,
    row.original.balance === 0 ? 'text-success' : row.original.status === 'vencida' ? 'text-error' : ''
  )
}]
const listConfig = computed<ListLayoutConfig>(() => ({
  id: 'purchases', title: 'Compras', empty: 'Sin compras para estos filtros.',
  search: { placeholder: 'Buscar proveedor' }, dateFilter: { subject: 'compras' }, tabs: statusItems,
  create: { label: 'Nueva compra', to: { path: '/compras/nueva', query: { returnTo: returnTo.value } } },
  pagination: { mode: 'client', label: 'compras', pageSize }
}))
</script>

<template>
  <ListLayout
    v-model:search="search"
    v-model:date-range="dateRange"
    v-model:tab="status"
    v-model:page="page"
    v-model:sorting="sorting"
    :config="listConfig"
    :data="purchases"
    :columns="columns"
    :meta="tableMeta"
    :loading="loading"
    :error="Boolean(error)"
    error-title="No se pudieron cargar las compras."
    :error-message="error?.data?.statusMessage"
    @refresh="refresh()"
  >
    <template #actions>
      <AppCsvExportButton
        filename="compras"
        :columns="csvColumns"
        :rows="purchases"
        :disabled="loading"
      />
      <UButton
        to="/compras/cuentas-por-pagar"
        label="Cuentas por pagar"
        icon="i-lucide-wallet"
        aria-label="Cuentas por pagar"
        color="neutral"
        variant="outline"
        :ui="{ label: 'hidden sm:inline' }"
      />
    </template>
  </ListLayout>
</template>
