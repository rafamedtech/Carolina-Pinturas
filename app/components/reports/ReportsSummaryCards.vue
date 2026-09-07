<script setup lang="ts">
import { reportCurrency } from '~/utils/reportPeriods'
import type { ReportMetrics } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{
  metrics: ReportMetrics
}>()

function comparison(value: number | null, inverse = false) {
  if (value === null) return { label: 'Sin comparativo', color: 'neutral' as const, icon: 'i-lucide-minus' }
  const isFavorable = inverse ? value <= 0 : value >= 0
  return {
    label: `${value > 0 ? '+' : ''}${dashboardNumber.format(value)}%`,
    color: isFavorable ? 'success' as const : 'error' as const,
    icon: value >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'
  }
}

const primaryMetrics = computed(() => [{
  title: 'Total vendido',
  value: reportCurrency.format(props.metrics.sales),
  description: `${props.metrics.orderCount} ${props.metrics.orderCount === 1 ? 'pedido activo' : 'pedidos activos'}`,
  icon: 'i-lucide-chart-no-axes-combined',
  accent: 'text-primary bg-primary/10',
  comparison: comparison(props.metrics.salesChangePercentage)
}, {
  title: 'Cantidad de ventas',
  value: dashboardNumber.format(props.metrics.orderCount),
  description: 'Pedidos sin borradores ni cancelados',
  icon: 'i-lucide-banknote-arrow-up',
  accent: 'text-success bg-success/10',
  comparison: comparison(props.metrics.previousOrderCount ? (props.metrics.orderCount - props.metrics.previousOrderCount) / props.metrics.previousOrderCount * 100 : null)
}, {
  title: 'Gastos pagados',
  value: reportCurrency.format(props.metrics.expenses),
  description: 'Egresos convertidos a MXN',
  icon: 'i-lucide-banknote-arrow-down',
  accent: 'text-warning bg-warning/10',
  comparison: comparison(props.metrics.expensesChangePercentage, true)
}, {
  title: 'Flujo neto',
  value: reportCurrency.format(props.metrics.netCashFlow),
  description: 'Cobros menos gastos',
  icon: 'i-lucide-scale',
  accent: 'text-info bg-info/10',
  comparison: comparison(props.metrics.netCashFlowChangePercentage)
}])

const operatingMetrics = computed(() => [{
  title: 'Cobros recibidos',
  value: reportCurrency.format(props.metrics.collections),
  detail: 'Entradas reales del mes',
  icon: 'i-lucide-banknote-arrow-up'
}, {
  title: 'Saldo por cobrar',
  value: reportCurrency.format(props.metrics.outstandingBalance),
  detail: `${dashboardNumber.format(props.metrics.collectionCoveragePercentage)}% cubierto en pedidos del mes`,
  icon: 'i-lucide-hourglass'
}, {
  title: 'Ticket promedio',
  value: reportCurrency.format(props.metrics.averageTicket),
  detail: 'Venta promedio por pedido',
  icon: 'i-lucide-receipt-text'
}])
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UCard
        v-for="metric in primaryMetrics"
        :key="metric.title"
        :ui="{ body: 'p-4 sm:p-5' }"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-medium tracking-wide text-muted uppercase">
            {{ metric.title }}
          </p>
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg" :class="metric.accent">
            <UIcon :name="metric.icon" class="size-4" />
          </span>
        </div>

        <p class="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-highlighted">
          {{ metric.value }}
        </p>

        <div class="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-default pt-3">
          <UBadge v-bind="metric.comparison" variant="soft" size="sm" />
          <span class="text-xs text-muted">vs. mes anterior completo</span>
          <span class="text-xs text-muted">{{ metric.description }}</span>
        </div>
      </UCard>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <dl class="grid divide-y divide-default sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div v-for="metric in operatingMetrics" :key="metric.title" class="flex items-start gap-3 p-4 sm:p-5">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-muted">
            <UIcon :name="metric.icon" class="size-4" />
          </span>
          <div class="min-w-0">
            <dt class="text-xs font-medium tracking-wide text-muted uppercase">
              {{ metric.title }}
            </dt>
            <dd class="mt-1 text-xl font-semibold tracking-tight tabular-nums text-highlighted">
              {{ metric.value }}
            </dd>
            <p class="mt-1 text-xs text-muted">
              {{ metric.detail }}
            </p>
          </div>
        </div>
      </dl>
    </UCard>
  </div>
</template>
