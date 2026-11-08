<script setup lang="ts">
import { reportCurrency, reportDailyAverage } from '~/utils/reportPeriods'
import type { BusinessReportSummary } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ report: BusinessReportSummary }>()

const annual = computed(() => props.report.period.mode === 'annual')

const pace = computed(() => {
  const { period, metrics } = props.report
  const dailySales = reportDailyAverage(metrics.sales, period.elapsedDays)
  const previousDailySales = reportDailyAverage(metrics.previousSales, metrics.previousDays)
  const inProgress = period.elapsedDays > 0 && period.elapsedDays < period.totalDays
  const projected = inProgress ? dailySales * period.totalDays : metrics.sales
  return {
    inProgress,
    dailySales,
    previousDailySales,
    dailyChange: previousDailySales ? (dailySales - previousDailySales) / previousDailySales * 100 : null,
    projected,
    projectedChange: metrics.previousSales ? (projected - metrics.previousSales) / metrics.previousSales * 100 : null,
    progress: period.totalDays ? period.elapsedDays / period.totalDays * 100 : 0
  }
})

function changeClass(value: number | null) {
  if (value === null) return 'text-muted'
  return value >= 0 ? 'text-success' : 'text-error'
}

function change(value: number | null) {
  return value === null ? 'Sin base' : `${value > 0 ? '+' : ''}${dashboardNumber.format(value)}%`
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-base font-semibold text-highlighted">
        {{ !report.period.elapsedDays ? 'Periodo sin iniciar' : pace.inProgress ? 'Proyección de cierre' : annual ? 'Cierre del año' : 'Cierre del mes' }}
      </h2>
      <p class="mt-1 text-sm text-muted">
        Día {{ report.period.elapsedDays }} de {{ report.period.totalDays }}
      </p>
    </template>

    <UProgress :model-value="pace.progress" size="xs" color="primary" />

    <div class="mt-4">
      <p class="text-xs text-muted">
        {{ pace.inProgress ? 'Venta estimada al cierre' : annual ? 'Venta del año' : 'Venta del mes' }}
      </p>
      <p class="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-highlighted">
        {{ reportCurrency.format(pace.projected) }}
      </p>
      <p class="mt-1 text-xs text-muted tabular-nums">
        <span :class="changeClass(pace.projectedChange)">{{ change(pace.projectedChange) }}</span>
        vs. {{ reportCurrency.format(report.metrics.previousSales) }} del {{ annual ? 'año' : 'mes' }} anterior
      </p>
    </div>

    <dl class="mt-4 grid grid-cols-2 gap-3 border-t border-default pt-3 text-xs">
      <div>
        <dt class="text-muted">
          Venta diaria
        </dt>
        <dd class="mt-0.5 font-semibold tabular-nums text-highlighted">
          {{ reportCurrency.format(pace.dailySales) }}
          <span class="font-normal" :class="changeClass(pace.dailyChange)">{{ change(pace.dailyChange) }}</span>
        </dd>
      </div>
      <div>
        <dt class="text-muted">
          {{ annual ? 'Año anterior' : 'Mes anterior' }} / día
        </dt>
        <dd class="mt-0.5 font-semibold tabular-nums text-highlighted">
          {{ reportCurrency.format(pace.previousDailySales) }}
        </dd>
      </div>
    </dl>
    <p v-if="pace.inProgress" class="mt-3 text-xs text-dimmed">
      Estimación lineal: venta diaria promedio × días del {{ annual ? 'año' : 'mes' }}.
    </p>
  </UCard>
</template>
