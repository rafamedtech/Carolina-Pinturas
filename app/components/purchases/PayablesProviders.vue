<script setup lang="ts">
import type { PayableRow } from '~/utils/purchasePayables'
import { payableBalance, payableMoney } from '~/utils/purchasePayables'
import { formatDate } from '~/utils/datetime'

const props = defineProps<{ rows: PayableRow[], returnTo: string }>()
const groups = computed(() => {
  const map = new Map<string, { key: string, name: string, currency: string, rows: PayableRow[] }>()
  for (const row of props.rows) {
    const key = `${row.providerId}:${row.currencyCode}`
    const group = map.get(key) ?? { key, name: row.providerName, currency: row.currencyCode, rows: [] }
    group.rows.push(row)
    map.set(key, group)
  }
  return [...map.values()].map(group => ({ ...group, balance: payableBalance(group.rows), overdue: payableBalance(group.rows.filter(row => row.daysUntilDue < 0)), next: group.rows.find(row => row.balance > 0) }))
    .sort((a, b) => b.overdue - a.overdue || b.balance - a.balance)
})
</script>

<template>
  <div class="space-y-3">
    <article v-for="group in groups" :key="group.key" class="rounded-xl border border-default p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="font-semibold">
            {{ group.name }}
          </h3><p class="mt-1 text-xs text-muted">
            {{ group.rows.length }} {{ group.rows.length === 1 ? 'factura' : 'facturas' }} · {{ group.currency }}<span v-if="group.next"> · Primer vencimiento: {{ formatDate(group.next.dueDate) }}</span>
          </p>
        </div>
        <div class="text-right tabular-nums">
          <p class="font-semibold">
            {{ payableMoney(group.balance) }} {{ group.currency }}
          </p><p class="mt-1 text-xs text-error">
            {{ payableMoney(group.overdue) }} vencidos
          </p>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton
          v-for="row in group.rows"
          :key="row.id"
          :to="{ path: `/compras/${row.orderId}`, query: { returnTo } }"
          color="neutral"
          variant="subtle"
          size="xs"
          :label="`${row.folio} · ${payableMoney(row.balance)}`"
        />
      </div>
    </article>
    <div v-if="!groups.length" class="rounded-xl border border-dashed border-default px-6 py-12 text-center">
      <UIcon name="i-lucide-check-check" class="size-7 text-muted" /><p class="mt-3 font-medium">
        Sin facturas para estos filtros
      </p><p class="mt-1 text-sm text-muted">
        Cambia el periodo, la moneda o el proveedor para consultar otras cuentas.
      </p>
    </div>
  </div>
</template>
