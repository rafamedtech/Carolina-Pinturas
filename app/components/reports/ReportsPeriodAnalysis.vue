<script setup lang="ts">
import { reportCurrency, reportDailyAverage, reportShortDate, reportWeeks } from '~/utils/reportPeriods'
import type { BusinessReportSummary } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ report: BusinessReportSummary }>()
const view = shallowRef('monthly')
const views = [
  { label: 'Mensual vs. anterior', value: 'monthly' },
  { label: 'Semanal', value: 'weekly' },
  { label: 'Promedio diario', value: 'daily' }
]
const weeks = computed(() => reportWeeks(props.report.dailyMovements))
const maxWeekly = computed(() => Math.max(1, ...weeks.value.map(week => week.sales)))
const comparisons = computed(() => {
  const m = props.report.metrics
  return [
    { label: 'Total vendido', current: m.sales, previous: m.previousSales, money: true },
    { label: 'Cantidad de ventas', current: m.orderCount, previous: m.previousOrderCount, money: false },
    { label: 'Mostrador', current: props.report.salesChannels.find(c => c.key === 'counter')?.amount ?? 0, previous: m.previousCounterSales, money: true },
    { label: 'Clientes del vendedor', current: props.report.salesChannels.find(c => c.key === 'seller')?.amount ?? 0, previous: m.previousSellerSales, money: true },
    { label: 'Gastos', current: m.expenses, previous: m.previousExpenses, money: true },
    { label: 'Cobros', current: m.collections, previous: m.previousCollections, money: true }
  ]
})
const rows = computed(() => comparisons.value.map((row) => {
  const current = view.value === 'daily' ? reportDailyAverage(row.current, props.report.period.elapsedDays) : row.current
  const previous = view.value === 'daily' ? reportDailyAverage(row.previous, props.report.metrics.previousDays) : row.previous
  return { ...row, current, previous, change: previous ? (current - previous) / previous * 100 : null }
}))
function format(value: number, money: boolean) {
  return money ? reportCurrency.format(value) : dashboardNumber.format(value)
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-base font-semibold text-highlighted">
        Comparación del negocio
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ report.period.elapsedDays }} días del mes seleccionado frente a {{ report.metrics.previousDays }} días del mes anterior completo.
      </p>
    </template>
    <div class="mb-5 flex flex-wrap gap-2" role="group" aria-label="Vista del reporte">
      <UButton
        v-for="item in views"
        :key="item.value"
        :label="item.label"
        :variant="view === item.value ? 'solid' : 'outline'"
        :color="view === item.value ? 'primary' : 'neutral'"
        :aria-pressed="view === item.value"
        @click="view = item.value"
      />
    </div>
    <template v-if="view === 'weekly'">
      <p class="mb-5 text-sm text-muted">
        Semanas de lunes a domingo, limitadas a los días transcurridos del mes seleccionado. Las semanas parciales indican sus días incluidos.
      </p>
      <div v-if="weeks.length" class="space-y-4">
        <div v-for="week in weeks" :key="week.start">
          <div class="mb-2 flex flex-wrap justify-between gap-2 text-sm">
            <span class="text-default">{{ reportShortDate(week.start) }} – {{ reportShortDate(week.end) }} <span class="text-muted">· {{ week.days }} {{ week.days === 1 ? 'día' : 'días' }}</span></span>
            <span class="font-semibold tabular-nums">{{ reportCurrency.format(week.sales) }} · {{ week.orderCount }} ventas</span>
          </div>
          <div class="flex h-5 overflow-hidden rounded bg-elevated" role="img" :aria-label="`Mostrador ${reportCurrency.format(week.counterSales)}; clientes del vendedor ${reportCurrency.format(week.sellerSales)}`">
            <div class="bg-primary" :style="{ width: `${week.counterSales / maxWeekly * 100}%` }" />
            <div class="bg-success" :style="{ width: `${week.sellerSales / maxWeekly * 100}%` }" />
          </div>
          <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span>Mostrador: {{ reportCurrency.format(week.counterSales) }}</span>
            <span>Vendedor: {{ reportCurrency.format(week.sellerSales) }}</span>
            <span>Gastos: {{ reportCurrency.format(week.expenses) }}</span>
            <span>Venta diaria: {{ reportCurrency.format(reportDailyAverage(week.sales, week.days)) }}</span>
          </div>
        </div>
      </div>
      <UEmpty v-else title="Sin días transcurridos" icon="i-lucide-calendar" />
    </template>
    <template v-else>
      <p v-if="view === 'daily'" class="mb-4 text-sm text-muted">
        Totales divididos entre días calendario, incluidos los días sin actividad. El mes actual usa únicamente días transcurridos.
      </p>
      <p v-else-if="report.period.elapsedDays < report.period.totalDays" class="mb-4 text-sm text-muted">
        Mes en curso: el comparativo mensual enfrenta un periodo parcial con el mes anterior completo. Usa el promedio diario para comparar el ritmo de venta.
      </p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="sr-only">
            {{ view === 'daily' ? 'Promedios diarios' : 'Totales mensuales' }} comparados con el mes anterior
          </caption>
          <thead class="border-b border-default text-xs text-muted">
            <tr>
              <th class="py-3 text-left font-medium">
                Indicador
              </th><th class="px-3 py-3 text-right font-medium">
                {{ view === 'daily' ? 'Actual / día' : 'Mes seleccionado' }}
              </th><th class="px-3 py-3 text-right font-medium">
                {{ view === 'daily' ? 'Anterior / día' : 'Mes anterior' }}
              </th><th class="py-3 text-right font-medium">
                Variación
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="row in rows" :key="row.label">
              <th class="py-3 text-left font-medium text-default">
                {{ row.label }}
              </th>
              <td class="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                {{ format(row.current, row.money) }}
              </td>
              <td class="px-3 py-3 text-right whitespace-nowrap tabular-nums text-muted">
                {{ format(row.previous, row.money) }}
              </td>
              <td class="py-3 text-right whitespace-nowrap tabular-nums text-muted">
                {{ row.change === null ? 'Sin base' : `${row.change > 0 ? '+' : ''}${dashboardNumber.format(row.change)}%` }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UCard>
</template>
