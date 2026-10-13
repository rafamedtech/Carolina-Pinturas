<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState, TableMeta } from '@tanstack/table-core'
import type { OrderDateRange } from '~/types/orders'
import type { PurchaseView } from '~/types/purchases'
import type { CsvColumn } from '~/utils/csv'
import { purchaseStatus } from '~/utils/purchaseFormat'
import { formatDate, mexicoToday } from '~/utils/datetime'

const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const NuxtLink = resolveComponent('NuxtLink')
const sorting = ref<SortingState>([])
const isHydrated = shallowRef(false)

onMounted(() => {
  isHydrated.value = true
})

const search = shallowRef('')
const status = shallowRef('all')
const dateRange = shallowRef<OrderDateRange | null>(null)
const statusItems = [
  { label: 'Todas', value: 'all' },
  { label: 'Borrador', value: 'borrador' },
  { label: 'Confirmada', value: 'confirmada' },
  { label: 'Liquidada', value: 'liquidada' },
  { label: 'Vencida', value: 'vencida' },
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

function sortableHeader(label: string, align: 'left' | 'right' = 'left') {
  return ({ column }: { column: Column<PurchaseView, unknown> }) => {
    const direction = column.getIsSorted()
    const nextDirection = column.getNextSortingOrder()
    const nextDirectionLabel = nextDirection === 'asc'
      ? 'ascendente'
      : nextDirection === 'desc'
        ? 'descendente'
        : 'quitar el orden'

    return h(UButton, {
      'label': label,
      'color': 'neutral',
      'variant': 'ghost',
      'size': 'sm',
      'class': align === 'right' ? 'w-full justify-end' : undefined,
      'trailingIcon': direction === 'asc'
        ? 'i-lucide-arrow-up'
        : direction === 'desc'
          ? 'i-lucide-arrow-down'
          : 'i-lucide-arrow-up-down',
      'aria-label': `Ordenar ${label} ${nextDirectionLabel}`,
      'onClick': () => column.toggleSorting()
    })
  }
}

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true
})

function formatAmount(amount: number, currencyCode: string, colorClass = '') {
  return h('div', { class: ['text-right font-bold', colorClass] }, `$${amountFormatter.format(amount)} ${currencyCode}`)
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
    { to: `/compras/${row.original.id}`, class: 'font-semibold text-primary underline' },
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
</script>

<template>
  <UDashboardPanel id="purchases">
    <template #header>
      <UDashboardNavbar title="Compras">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template><template #right>
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
          <UButton
            to="/compras/nueva"
            label="Nueva compra"
            icon="i-lucide-plus"
            aria-label="Nueva compra"
            :ui="{ label: 'hidden sm:inline' }"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <PurchasesPurchaseListToolbar
        v-model:search="search"
        v-model:status="status"
        v-model:date-range="dateRange"
        :status-items="statusItems"
      />
      <UTabs
        v-model="status"
        :items="statusItems"
        class="hidden w-full sm:block"
      />
      <UAlert v-if="error" title="No se pudieron cargar las compras." color="error" />
      <div
        v-else-if="loading"
        class="flex shrink-0 flex-col items-center justify-center gap-3 py-16"
        role="status"
        aria-busy="true"
      >
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-primary" />
        <p class="text-sm text-muted">
          Cargando
        </p>
        <span class="sr-only">Cargando compras…</span>
      </div>
      <p v-else-if="!data?.results.length" class="py-10 text-center text-muted">
        Sin compras para estos filtros.
      </p>
      <UTable
        v-else
        v-model:sorting="sorting"
        :data="purchases"
        :columns="columns"
        :meta="tableMeta"
        class="shrink-0"
        :ui="{
          base: 'min-w-full border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      />
    </template>
  </UDashboardPanel>
</template>
