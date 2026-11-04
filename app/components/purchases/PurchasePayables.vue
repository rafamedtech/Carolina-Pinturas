<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import type { TableColumn } from '@nuxt/ui'
import { tableQueryField, tableQueryText, tableQueryBoolean, tableQueryPage } from '~/utils/tableQuery'
import type { PurchaseView } from '~/types/purchases'
import { formatDate, mexicoToday } from '~/utils/datetime'
import type { PayablePeriod, PayableRow } from '~/utils/purchasePayables'
import { payableRows, inPayablePeriod, payableBalance, payableMoney, payableTiming } from '~/utils/purchasePayables'

const { data, error, status: requestStatus, refresh } = useFetch<{ results: PurchaseView[] }>('/api/purchases', { lazy: true, server: false })
const page = shallowRef(1)
const status = shallowRef('pendiente')
const search = shallowRef('')
const grouped = shallowRef(false)
const currency = shallowRef('MXN')
const period = shallowRef<PayablePeriod>('all')
const today = shallowRef(mexicoToday())
// Actualizar el corte si la pestaña permanece abierta durante el cambio de día.
useIntervalFn(() => {
  today.value = mexicoToday()
}, 60_000)
const { returnTo } = useTableQuery([
  tableQueryField('search', search, tableQueryText()),
  tableQueryField('status', status, tableQueryText('pendiente', ['all', 'pendiente', 'vencida', 'liquidada'])),
  tableQueryField('currency', currency, tableQueryText('MXN', ['MXN', 'USD'])),
  tableQueryField('period', period, tableQueryText('all', ['all', 'week', 'month', 'overdue'])),
  tableQueryField('grouped', grouped, tableQueryBoolean),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [search, status, grouped, currency, period] })
const loading = computed(() => ['idle', 'pending'].includes(requestStatus.value))
const allRows = computed(() => payableRows(data.value?.results ?? [], today.value))
const currencyRows = computed(() => allRows.value.filter(row => row.currencyCode === currency.value))
const rows = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('es-MX')
  return currencyRows.value.filter(row =>
    (status.value === 'all' || (status.value === 'pendiente' ? row.balance > 0 : row.status === status.value))
    && inPayablePeriod(row, period.value, today.value)
    && `${row.providerName} ${row.folio} OC-${row.orderFolio}`.toLocaleLowerCase('es-MX').includes(query))
})
const balance = computed(() => payableBalance(rows.value))
const NuxtLink = resolveComponent('NuxtLink')
const columns: TableColumn<PayableRow>[] = [
  { id: 'folio', header: 'Factura / orden', cell: ({ row }) => h(NuxtLink, { to: { path: `/compras/${row.original.orderId}`, query: { returnTo: returnTo.value } }, class: 'font-medium text-highlighted underline decoration-muted underline-offset-4 hover:decoration-primary' }, () => `${row.original.folio} / OC-${row.original.orderFolio}`) },
  { accessorKey: 'providerName', header: 'Proveedor' },
  { accessorKey: 'dueDate', header: 'Vencimiento', cell: ({ row }) => h('div', [h('p', { class: 'tabular-nums' }, formatDate(row.original.dueDate)), h('p', { class: `mt-1 text-xs ${row.original.balance > 0 && row.original.daysUntilDue <= 0 ? 'text-error' : 'text-muted'}` }, payableTiming(row.original))]) },
  { accessorKey: 'amount', header: 'Importe', cell: ({ row }) => h('span', { class: 'tabular-nums' }, payableMoney(row.original.amount)) },
  { id: 'paid', header: 'Abonado', cell: ({ row }) => h('span', { class: 'tabular-nums text-muted' }, payableMoney(row.original.amount - row.original.balance)) },
  { accessorKey: 'balance', header: 'Saldo pendiente', cell: ({ row }) => h('span', { class: 'font-semibold tabular-nums' }, `${payableMoney(row.original.balance)} ${row.original.currencyCode}`) },
  { id: 'actions', header: 'Gestión', cell: ({ row }) => h(NuxtLink, { 'to': { path: `/compras/${row.original.orderId}`, query: { returnTo: returnTo.value } }, 'class': 'text-sm font-medium text-primary hover:underline', 'aria-label': `Ver compra OC-${row.original.orderFolio}, factura ${row.original.folio}` }, () => 'Ver compra →') }
]
const filterValues = useListFilterBindings({ grouped })
const listConfig = computed<ListLayoutConfig>(() => ({
  id: 'purchase-payables', title: 'Cuentas por pagar', empty: 'Sin facturas para estos filtros. Cambia el periodo, la moneda o la búsqueda.',
  search: { placeholder: 'Buscar proveedor, factura u orden' },
  defaultTab: 'pendiente',
  tabs: [{ label: 'Por pagar', value: 'pendiente' }, { label: 'Vencidas', value: 'vencida' }, { label: 'Liquidadas', value: 'liquidada' }, { label: 'Todas', value: 'all' }],
  filters: [{ key: 'grouped', label: 'Agrupar por proveedor', type: 'checkbox', defaultValue: false }],
  pagination: grouped.value ? undefined : { mode: 'client', label: 'facturas', pageSize: 25 }
}))
const periodLabels: Record<PayablePeriod, string> = { all: 'Todos los vencimientos', week: 'Por vencer esta semana', month: 'Por vencer este mes', overdue: 'Vencidas' }
function selectPeriod(value: PayablePeriod) {
  period.value = value
  status.value = 'pendiente'
}
function selectProvider(name: string) {
  search.value = name
  period.value = 'all'
  status.value = 'pendiente'
}
function clear() {
  period.value = 'all'
  currency.value = 'MXN'
}
// Los históricos liquidados no deben quedar ocultos por un filtro de vencimientos abiertos.
watch(status, (value) => {
  if (value !== 'pendiente') period.value = 'all'
})
</script>

<template>
  <ListLayout
    v-model:search="search"
    v-model:tab="status"
    v-model:filters="filterValues"
    v-model:page="page"
    :config="listConfig"
    :data="rows"
    :columns="columns"
    :loading="loading"
    :error="Boolean(error)"
    error-title="No se pudieron cargar las cuentas por pagar."
    @refresh="refresh()"
    @clear="clear"
  >
    <template #actions>
      <UButton
        to="/compras"
        label="Ver compras"
        icon="i-lucide-arrow-up-right"
        color="neutral"
        variant="ghost"
      />
      <USelect
        v-model="currency"
        :items="[{ label: 'Pesos · MXN', value: 'MXN' }, { label: 'Dólares · USD', value: 'USD' }]"
        aria-label="Moneda de cuentas por pagar"
        class="w-36 sm:w-44"
      />
    </template>
    <template #before>
      <PurchasesPayablesOverview
        :rows="currencyRows"
        :today="today"
        :currency="currency"
        :period="period"
        :loading="loading"
        :failed="Boolean(error)"
        @select="selectPeriod"
        @provider="selectProvider"
      />
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-5">
        <div>
          <h2 class="font-semibold">
            Detalle de facturas
          </h2><p class="mt-1 text-xs text-muted">
            {{ periodLabels[period] }} · Ordenadas por vencimiento, de más antiguo a más reciente
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            v-if="period !== 'all'"
            label="Quitar periodo"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="period = 'all'"
          />
          <span v-if="!loading && !error" class="text-sm tabular-nums">{{ rows.length }} {{ rows.length === 1 ? 'factura' : 'facturas' }} <span class="mx-2 text-muted">/</span> <strong>{{ payableMoney(balance) }} {{ currency }}</strong></span>
        </div>
      </div>
    </template>
    <template v-if="grouped" #content>
      <PurchasesPayablesProviders :rows="rows" :return-to="returnTo" />
    </template>
  </ListLayout>
</template>
