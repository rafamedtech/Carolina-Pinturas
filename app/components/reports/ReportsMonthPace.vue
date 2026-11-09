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
  <DetailCard class="min-w-0" :ui="{ container: 'min-w-0' }">
    <div class="space-y-3">
      <DetailSectionHeading :title="!report.period.elapsedDays ? 'Periodo sin iniciar' : pace.inProgress ? 'Proyección de cierre' : annual ? 'Cierre del año' : 'Cierre del mes'" :ui="{ title: 'text-base' }" />
      <p class="mt-1 text-sm text-muted">
        Día {{ report.period.elapsedDays }} de {{ report.period.totalDays }}
      </p>
    </div>

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

    <DetailFields
      :fields="[
        { key: 'daily', label: 'Venta diaria', value: reportCurrency.format(pace.dailySales) },
        { key: 'previous', label: `${annual ? 'Año anterior' : 'Mes anterior'} / día`, value: reportCurrency.format(pace.previousDailySales) }
      ]"
      class="mt-4 border-t border-default pt-3"
    >
      <template #value="{ field }">
        <span class="tabular-nums text-highlighted">{{ field.value }}</span>
        <span v-if="field.key === 'daily'" class="ml-1 font-normal" :class="changeClass(pace.dailyChange)">{{ change(pace.dailyChange) }}</span>
      </template>
    </DetailFields>
    <p v-if="pace.inProgress" class="mt-3 text-xs text-dimmed">
      Estimación lineal: venta diaria promedio × días del {{ annual ? 'año' : 'mes' }}.
    </p>
  </DetailCard>
</template>
