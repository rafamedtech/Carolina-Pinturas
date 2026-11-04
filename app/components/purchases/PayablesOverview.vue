<script setup lang="ts">
import type { PayablePeriod, PayableRow } from '~/utils/purchasePayables'
import { inPayablePeriod, payableBalance, payableMoney, payablePeriodEnd } from '~/utils/purchasePayables'
import { formatDate, formatDateRange } from '~/utils/datetime'

const props = defineProps<{ rows: PayableRow[], today: string, currency: string, period: PayablePeriod, loading: boolean, failed: boolean }>()
const emit = defineEmits<{ select: [period: PayablePeriod], provider: [name: string] }>()
const pending = computed(() => props.rows.filter(row => row.balance > 0))
const cards = computed(() => [
  { key: 'all' as const, label: 'Total pendiente', detail: `${new Set(pending.value.map(row => row.providerId)).size} ${new Set(pending.value.map(row => row.providerId)).size === 1 ? 'proveedor' : 'proveedores'}`, icon: 'i-lucide-wallet' },
  { key: 'overdue' as const, label: 'Vencidas', detail: 'Requieren atención', icon: 'i-lucide-alarm-clock' },
  { key: 'week' as const, label: 'Por vencer esta semana', detail: `Hasta el ${formatDate(payablePeriodEnd(props.today, 'week'))}`, icon: 'i-lucide-calendar-days' },
  { key: 'month' as const, label: 'Por vencer este mes', detail: `Hasta el ${formatDate(payablePeriodEnd(props.today, 'month'))}`, icon: 'i-lucide-calendar-range' }
].map((card) => {
  const invoices = pending.value.filter(row => inPayablePeriod(row, card.key, props.today))
  return { ...card, count: invoices.length, balance: payableBalance(invoices) }
}))
const aging = computed(() => [
  { label: '1–7 días', min: 1, max: 7 }, { label: '8–30 días', min: 8, max: 30 },
  { label: '31–60 días', min: 31, max: 60 }, { label: 'Más de 60 días', min: 61, max: Infinity }
].map(bucket => ({ ...bucket, balance: payableBalance(pending.value.filter(row => -row.daysUntilDue >= bucket.min && -row.daysUntilDue <= bucket.max)) })))
const providers = computed(() => {
  const groups = new Map<string, { id: string, name: string, rows: PayableRow[] }>()
  for (const row of pending.value) {
    const group = groups.get(row.providerId) ?? { id: row.providerId, name: row.providerName, rows: [] }
    group.rows.push(row)
    groups.set(row.providerId, group)
  }
  return [...groups.values()].map(group => ({ ...group, balance: payableBalance(group.rows), overdue: payableBalance(group.rows.filter(row => row.daysUntilDue < 0)) }))
    .sort((a, b) => b.balance - a.balance).slice(0, 4)
})
</script>

<template>
  <section class="space-y-5" aria-label="Resumen de cuentas por pagar" :aria-busy="loading">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-semibold tracking-widest text-muted">
          CONTROL DE PAGOS
        </p>
        <h2 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Anticipa tus próximos pagos
        </h2>
        <p class="mt-2 text-sm text-muted">
          Saldos abiertos en {{ currency }} · Corte al {{ formatDate(today) }}
        </p>
      </div>
      <p class="max-w-sm text-xs leading-relaxed text-muted">
        Semana y mes incluyen vencimientos desde hoy. Las cuentas vencidas se muestran por separado.
      </p>
    </div>
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="card in cards"
        :key="card.key"
        type="button"
        :aria-pressed="period === card.key"
        class="rounded-xl border p-5 text-left transition duration-200 hover:bg-elevated active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="period === card.key ? 'border-primary bg-elevated ring-1 ring-primary' : 'border-default bg-default'"
        @click="emit('select', card.key)"
      >
        <div class="flex items-center justify-between gap-2 text-sm font-medium">
          <span>{{ card.label }}</span><UIcon :name="card.icon" class="size-4 shrink-0" :class="card.key === 'overdue' ? 'text-error' : 'text-muted'" />
        </div>
        <USkeleton v-if="loading" class="my-3 h-8 w-36" />
        <p v-else class="mt-3 text-2xl font-semibold tracking-tight tabular-nums" :class="card.key === 'overdue' && card.balance > 0 ? 'text-error' : 'text-highlighted'">
          {{ failed ? '—' : payableMoney(card.balance) }}
        </p>
        <p class="mt-2 text-xs text-muted">
          {{ loading ? 'Calculando saldos…' : failed ? 'Resumen no disponible' : `${card.count} ${card.count === 1 ? 'factura' : 'facturas'} · ${card.detail}` }}
        </p>
      </button>
    </div>
    <div v-if="!loading && !failed" class="grid gap-5 rounded-xl border border-default bg-muted/30 p-5 lg:grid-cols-2 lg:gap-8">
      <section aria-label="Antigüedad de saldos vencidos">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold">
            Antigüedad de la deuda vencida
          </h3><span class="text-xs text-muted">{{ currency }}</span>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div v-for="bucket in aging" :key="bucket.label" class="border-l-2 border-error/30 pl-3">
            <p class="text-xs text-muted">
              {{ bucket.label }}
            </p>
            <p class="mt-2 text-sm font-semibold tabular-nums">
              {{ payableMoney(bucket.balance) }}
            </p>
          </div>
        </div>
        <p class="mt-4 text-xs text-muted">
          {{ formatDateRange(today, payablePeriodEnd(today, 'week')) }} · Desde hoy hasta el domingo.
        </p>
      </section>
      <section aria-label="Proveedores con mayor saldo">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold">
            Proveedores con mayor saldo
          </h3><span class="text-xs text-muted">Pendiente / vencido</span>
        </div>
        <div class="mt-2 divide-y divide-default">
          <button
            v-for="provider in providers"
            :key="provider.id"
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded px-1 py-2 text-left text-xs transition hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary"
            @click="emit('provider', provider.name)"
          >
            <span class="min-w-0 truncate font-medium">{{ provider.name }} <span class="text-muted">· {{ provider.rows.length }}</span></span>
            <span class="shrink-0 tabular-nums">{{ payableMoney(provider.balance) }} <span class="text-error">/ {{ payableMoney(provider.overdue) }}</span></span>
          </button>
        </div>
        <p v-if="!providers.length" class="py-4 text-sm text-muted">
          No tienes saldos pendientes en {{ currency }}.
        </p>
      </section>
    </div>
  </section>
</template>
