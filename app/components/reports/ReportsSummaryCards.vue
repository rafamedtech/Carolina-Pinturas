<script setup lang="ts">
import { reportCurrency } from '~/utils/reportPeriods'
import type { ReportMetrics } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{
  metrics: ReportMetrics
}>()

function comparison(value: number | null, inverse = false) {
  if (value === null) return { label: 'Sin base', color: 'neutral' as const, icon: 'i-lucide-minus' }
  const isFavorable = inverse ? value <= 0 : value >= 0
  return {
    label: `${value > 0 ? '+' : ''}${dashboardNumber.format(value)}%`,
    color: isFavorable ? 'success' as const : 'error' as const,
    icon: value >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
  }
}

function count(value: number, singular: string, plural: string) {
  return `${dashboardNumber.format(value)} ${value === 1 ? singular : plural}`
}

const cards = computed(() => {
  const m = props.metrics
  return [{
    title: 'Ventas netas',
    value: reportCurrency.format(m.salesBeforeTax),
    previous: reportCurrency.format(m.previousSales),
    icon: 'i-lucide-chart-no-axes-combined',
    accent: 'text-primary bg-primary/10',
    comparison: comparison(m.salesBeforeTaxChangePercentage),
    details: [
      `${count(m.orderCount, 'venta', 'ventas')} (ant. ${dashboardNumber.format(m.previousOrderCount)})`,
      `Ticket promedio ${reportCurrency.format(m.averageTicket)}`
    ]
  }, {
    title: 'Cobrado',
    value: reportCurrency.format(m.collections),
    previous: reportCurrency.format(m.previousCollections),
    icon: 'i-lucide-banknote-arrow-up',
    accent: 'text-success bg-success/10',
    comparison: comparison(m.collectionsChangePercentage),
    details: [
      `${dashboardNumber.format(m.collectionCoveragePercentage)}% de pedidos del mes cubierto`
    ]
  }, {
    title: 'Gastos operativos',
    value: reportCurrency.format(m.operatingExpenses),
    previous: reportCurrency.format(m.previousOperatingExpenses),
    icon: 'i-lucide-banknote-arrow-down',
    accent: 'text-warning bg-warning/10',
    comparison: comparison(m.operatingExpensesChangePercentage, true),
    details: [
      'Sin compra de materiales · MXN',
      `Total con materiales ${reportCurrency.format(m.expenses)} (ant. ${reportCurrency.format(m.previousExpenses)})`
    ]
  }, {
    title: 'Flujo neto',
    value: reportCurrency.format(m.netCashFlow),
    previous: reportCurrency.format(m.previousNetCashFlow),
    icon: 'i-lucide-scale',
    accent: 'text-info bg-info/10',
    comparison: comparison(m.netCashFlowChangePercentage),
    details: ['Cobros menos gastos totales']
  }]
})
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <UCard
      v-for="card in cards"
      :key="card.title"
      :ui="{ body: 'p-4 sm:p-5' }"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-medium tracking-wide text-muted uppercase">
          {{ card.title }}
        </p>
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg" :class="card.accent">
          <UIcon :name="card.icon" class="size-4" />
        </span>
      </div>

      <p class="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-highlighted">
        {{ card.value }}
      </p>

      <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <UBadge v-bind="card.comparison" variant="soft" size="sm" />
        <span class="text-xs text-muted">
          vs. mes anterior<template v-if="card.previous"> · {{ card.previous }}</template>
        </span>
      </div>

      <ul class="mt-4 space-y-1 border-t border-default pt-3 text-xs text-muted">
        <li v-for="detail in card.details" :key="detail" class="tabular-nums">
          {{ detail }}
        </li>
      </ul>
    </UCard>
  </div>
</template>
