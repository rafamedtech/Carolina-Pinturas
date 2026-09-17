<script setup lang="ts">
import Decimal from 'decimal.js'
import type { PurchaseView } from '~/types/purchases'

const { data, error, refresh } = await useFetch<{ results: PurchaseView[] }>('/api/purchases')
const status = shallowRef('all')
const search = shallowRef('')
const grouped = shallowRef(false)
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
</script>

<template>
  <UDashboardPanel id="purchase-payables">
    <template #header>
      <UDashboardNavbar title="Cuentas por pagar">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template><template #right>
          <UButton to="/compras" label="Compras" variant="ghost" /><UButton label="Recargar" variant="ghost" @click="refresh()" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <UAlert v-if="error" title="No se pudieron cargar las cuentas por pagar." color="error" />
      <div class="flex flex-wrap gap-3">
        <UInput v-model="search" placeholder="Buscar proveedor" aria-label="Buscar proveedor" /><USelect v-model="status" aria-label="Estado de factura" :items="[{ label: 'Todas', value: 'all' }, { label: 'Pendientes', value: 'pendiente' }, { label: 'Vencidas', value: 'vencida' }, { label: 'Liquidadas', value: 'liquidada' }]" /><UCheckbox v-model="grouped" label="Agrupar por proveedor" />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <UCard v-for="total in totals" :key="total.currency">
          <p class="text-sm text-muted">
            Saldo filtrado · {{ total.currency }}
          </p><p class="text-2xl font-semibold">
            {{ total.balance }}
          </p>
        </UCard>
      </div>
      <template v-if="grouped">
        <UCard v-for="group in groups" :key="group.key">
          <div class="flex justify-between">
            <span>{{ group.name }}</span><strong>{{ group.balance.toFixed(2) }} {{ group.currency }}</strong>
          </div>
        </UCard>
      </template>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-default">
              <th class="p-3">
                Factura / orden
              </th><th class="p-3">
                Proveedor
              </th><th class="p-3">
                Vencimiento
              </th><th class="p-3">
                Estado
              </th><th class="p-3">
                Importe
              </th><th class="p-3">
                Saldo
              </th>
            </tr>
          </thead><tbody>
            <tr v-for="row in rows" :key="row.id" class="border-b border-default">
              <td class="p-3">
                <NuxtLink :to="`/compras/${row.orderId}`" class="text-primary underline">{{ row.folio }} / OC-{{ row.orderFolio }}</NuxtLink>
              </td><td class="p-3">
                {{ row.providerName }}
              </td><td class="p-3">
                {{ row.dueDate }}
              </td><td class="p-3">
                {{ row.status }}
              </td><td class="p-3">
                {{ row.amount.toFixed(2) }} {{ row.currencyCode }}
              </td><td class="p-3">
                {{ row.balance.toFixed(2) }} {{ row.currencyCode }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!rows.length && !error" class="py-8 text-center text-muted">
        Sin facturas para estos filtros.
      </p>
    </template>
  </UDashboardPanel>
</template>
