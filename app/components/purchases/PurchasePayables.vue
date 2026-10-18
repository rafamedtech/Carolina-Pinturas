<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import type { TableColumn } from '@nuxt/ui'
import { tableQueryField, tableQueryText, tableQueryBoolean, tableQueryPage } from '~/utils/tableQuery'
import Decimal from 'decimal.js'
import type { PurchaseView } from '~/types/purchases'
import { formatDate } from '~/utils/datetime'

const { data, error, status: requestStatus, refresh } = await useFetch<{ results: PurchaseView[] }>('/api/purchases')
const page = shallowRef(1)
const status = shallowRef('all')
const search = shallowRef('')
const grouped = shallowRef(false)
const { returnTo } = useTableQuery([
  tableQueryField('search', search, tableQueryText()),
  tableQueryField('status', status, tableQueryText('all', ['all', 'pendiente', 'vencida', 'liquidada'])),
  tableQueryField('grouped', grouped, tableQueryBoolean),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [search, status, grouped] })
const rows = computed(() => (data.value?.results ?? []).flatMap(o => o.invoices.filter(i => !i.voidedAt).map(i => ({ ...i, orderId: o.id, orderFolio: o.folio, providerId: o.providerId, providerName: o.providerName, currencyCode: o.currencyCode }))).filter(i => (status.value === 'all' || i.status === status.value) && i.providerName.toLowerCase().includes(search.value.toLowerCase())))
const totals = computed(() => ['MXN', 'USD'].map(currency => ({ currency, balance: rows.value.filter(i => i.currencyCode === currency).reduce((sum, i) => sum.plus(i.balance), new Decimal(0)).toFixed(2) })))
const groups = computed(() => {
  const map = new Map<string, { key: string, name: string, currency: string, balance: Decimal }>()
  for (const row of rows.value) {
    const key = `${row.providerId}:${row.currencyCode}`
    const group = map.get(key) ?? { key, name: row.providerName, currency: row.currencyCode, balance: new Decimal(0) }
    group.balance = group.balance.plus(row.balance)
    map.set(key, group)
  }
  return [...map.values()]
})
type PayableRow = typeof rows.value[number]
const NuxtLink = resolveComponent('NuxtLink')
const columns: TableColumn<PayableRow>[] = [
  { id: 'folio', header: 'Factura / orden', cell: ({ row }) => h(NuxtLink, { to: { path: `/compras/${row.original.orderId}`, query: { returnTo: returnTo.value } }, class: 'text-primary underline' }, () => `${row.original.folio} / OC-${row.original.orderFolio}`) },
  { accessorKey: 'providerName', header: 'Proveedor' },
  { accessorKey: 'dueDate', header: 'Vencimiento', cell: ({ row }) => formatDate(row.original.dueDate) },
  { accessorKey: 'status', header: 'Estado' },
  { accessorKey: 'amount', header: 'Importe', cell: ({ row }) => `${row.original.amount.toFixed(2)} ${row.original.currencyCode}` },
  { accessorKey: 'balance', header: 'Saldo', cell: ({ row }) => `${row.original.balance.toFixed(2)} ${row.original.currencyCode}` }
]
const filterValues = useListFilterBindings({ grouped })
const listConfig = computed<ListLayoutConfig>(() => ({
  id: 'purchase-payables', title: 'Cuentas por pagar', empty: 'Sin facturas para estos filtros.',
  search: { placeholder: 'Buscar proveedor' },
  tabs: [{ label: 'Todas', value: 'all' }, { label: 'Pendientes', value: 'pendiente' }, { label: 'Vencidas', value: 'vencida' }, { label: 'Liquidadas', value: 'liquidada' }],
  filters: [{ key: 'grouped', label: 'Agrupar por proveedor', type: 'checkbox', defaultValue: false }],
  pagination: grouped.value ? undefined : { mode: 'client', label: 'facturas', pageSize: 25 }
}))
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
    :loading="requestStatus === 'pending'"
    :error="Boolean(error)"
    error-title="No se pudieron cargar las cuentas por pagar."
    @refresh="refresh()"
  >
    <template #actions>
      <UButton to="/compras" label="Compras" variant="ghost" />
    </template>
    <template #before>
      <div class="grid gap-3 sm:grid-cols-2">
        <UCard v-for="total in totals" :key="total.currency">
          <p class="text-sm text-muted">
            Saldo filtrado · {{ total.currency }}
          </p>
          <p class="text-2xl font-semibold">
            {{ total.balance }}
          </p>
        </UCard>
      </div>
    </template>
    <template v-if="grouped" #content>
      <UCard v-for="group in groups" :key="group.key">
        <div class="flex justify-between">
          <span>{{ group.name }}</span><strong>{{ group.balance.toFixed(2) }} {{ group.currency }}</strong>
        </div>
      </UCard>
      <p v-if="!groups.length" class="py-8 text-center text-muted">
        Sin facturas para estos filtros.
      </p>
    </template>
  </ListLayout>
</template>
