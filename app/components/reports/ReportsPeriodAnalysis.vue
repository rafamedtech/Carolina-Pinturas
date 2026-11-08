<script setup lang="ts">
import { tableQueryField, tableQueryText } from '~/utils/tableQuery'
import { reportCurrency, reportDailyAverage, reportWeeks, reportVisibleMonths } from '~/utils/reportPeriods'
import type { BusinessReportSummary } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ report: BusinessReportSummary }>()
const annual = computed(() => props.report.period.mode === 'annual')
const view = shallowRef('weekly')
useTableQuery([tableQueryField('analysis_view', view, tableQueryText('weekly', ['weekly', 'daily']))])
const views = computed(() => [
  { label: annual.value ? 'Mensual' : 'Semanal', value: 'weekly' },
  { label: 'Promedio diario', value: 'daily' }
])
const weeks = computed(() => annual.value ? reportVisibleMonths(props.report.dailyMovements) : reportWeeks(props.report.dailyMovements))
const comparisons = computed(() => {
  const m = props.report.metrics
  return [
    { label: 'Total vendido', current: m.sales, previous: m.previousSales, money: true },
    { label: 'Cantidad de ventas', current: m.orderCount, previous: m.previousOrderCount, money: false },
    { label: 'Mostrador', current: props.report.salesChannels.find(c => c.key === 'counter')?.amount ?? 0, previous: m.previousCounterSales, money: true },
    { label: 'Vendedor', current: props.report.salesChannels.find(c => c.key === 'seller')?.amount ?? 0, previous: m.previousSellerSales, money: true },
    { label: 'Clientes internos', current: props.report.salesChannels.find(c => c.key === 'internal')?.amount ?? 0, previous: m.previousInternalSales, money: true },
    { label: 'Compras de material', current: m.materialPurchases, previous: m.previousMaterialPurchases, money: true },
    { label: 'Gastos operativos', current: m.operatingExpenses, previous: m.previousOperatingExpenses, money: true },
    { label: 'Utilidad neta', current: m.netProfit, previous: m.previousNetProfit, money: true }
  ]
})
const rows = computed(() => comparisons.value.map((row) => {
  const current = reportDailyAverage(row.current, props.report.period.elapsedDays)
  const previous = reportDailyAverage(row.previous, props.report.metrics.previousDays)
  return { ...row, current, previous, change: previous ? (current - previous) / Math.abs(previous) * 100 : null }
}))
function format(value: number, money: boolean) {
  return money ? reportCurrency.format(value) : dashboardNumber.format(value)
}
</script>

<template>
  <UCard id="reports-sales-pace">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            Ritmo de venta
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ view === 'weekly' ? `Cuánto vendes cada ${annual ? 'mes' : 'semana'}, de un vistazo.` : `Compara el promedio por día con el ${annual ? 'año' : 'mes'} anterior.` }}
          </p>
        </div>
        <div class="inline-flex rounded-lg bg-elevated p-1" role="group" aria-label="Vista del ritmo de venta">
          <UButton
            v-for="item in views"
            :key="item.value"
            size="sm"
            :label="item.label"
            :variant="view === item.value ? 'solid' : 'ghost'"
            :color="view === item.value ? 'primary' : 'neutral'"
            :aria-pressed="view === item.value"
            @click="view = item.value"
          />
        </div>
      </div>
    </template>

    <ReportsWeeklySales v-if="view === 'weekly'" :weeks="weeks" :annual="annual" />
    <template v-else>
      <div class="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
        <span class="inline-flex items-center gap-2">
          <span class="size-2 rounded-full bg-primary" aria-hidden="true" />
          {{ annual ? 'Año seleccionado' : 'Mes seleccionado' }} · {{ report.period.elapsedDays }} días
        </span>
        <span class="inline-flex items-center gap-2">
          <span class="size-2 rounded-full bg-neutral-400 dark:bg-neutral-500" aria-hidden="true" />
          {{ annual ? 'Año anterior' : 'Mes anterior' }} · {{ report.metrics.previousDays }} días
        </span>
      </div>
      <UEmpty v-if="!report.period.elapsedDays" title="Sin días transcurridos" icon="i-lucide-calendar" />
      <div v-else class="grid gap-4 lg:grid-cols-2">
        <ReportsPaceComparison
          v-for="row in rows"
          :key="row.label"
          :label="row.label"
          :current="row.current"
          :previous="row.previous"
          :current-label="format(row.current, row.money)"
          :previous-label="format(row.previous, row.money)"
          :change="row.change"
          :annual="annual"
        />
      </div>
      <p class="mt-4 text-xs text-muted">
        Promedios por día calendario, incluidos los días sin actividad. Cada indicador tiene su propia escala.
      </p>
    </template>
  </UCard>
</template>
