<script setup lang="ts">
import type { ReportDailyMovement } from '~/types/reports'
import { dashboardCompactCurrency, dashboardCurrency } from '~/utils/dashboardFormatters'
import { reportVisibleMonths, reportWeeks } from '~/utils/reportPeriods'
import { formatDateRange } from '~/utils/datetime'

const props = defineProps<{
  data: ReportDailyMovement[]
  annual?: boolean
}>()

type ChartMovement = Pick<ReportDailyMovement, 'date' | 'label' | 'sales' | 'materialPurchases' | 'operatingExpenses' | 'netProfit'>

const movements = computed<ChartMovement[]>(() => props.annual
  ? reportVisibleMonths(props.data)
  : reportWeeks(props.data).map(week => ({
      ...week,
      date: week.start,
      label: formatDateRange(week.start, week.end, 'short')
    })))

const totals = computed(() => movements.value.reduce((result, day) => ({
  sales: result.sales + day.sales,
  materialPurchases: result.materialPurchases + day.materialPurchases,
  operatingExpenses: result.operatingExpenses + day.operatingExpenses,
  netProfit: result.netProfit + day.netProfit
}), { sales: 0, materialPurchases: 0, operatingExpenses: 0, netProfit: 0 }))

const maximum = computed(() => Math.max(
  ...movements.value.flatMap(day => [day.sales, day.materialPurchases, day.operatingExpenses]),
  0
))
const hasMovements = computed(() => maximum.value > 0)
const trendPoints = computed(() => movements.value.map((movement, index) => ({
  date: movement.date,
  x: (index + 0.5) / movements.value.length * 100,
  y: maximum.value > 0 ? (1 - movement.sales / maximum.value) * 256 : 256
})))
const trendLine = computed(() => trendPoints.value.map(point => `${point.x * 10},${point.y}`).join(' '))
const columns = computed(() => ({
  gridTemplateColumns: `repeat(${movements.value.length}, minmax(${props.annual ? 80 : 128}px, 1fr))`
}))

const hoveredDate = shallowRef<string | null>(null)
const hoveredDay = computed(() => movements.value.find(day => day.date === hoveredDate.value) ?? null)

const series = computed(() => [{
  key: 'sales' as const,
  label: 'Ventas',
  dot: 'bg-primary',
  bar: 'bg-primary'
}, {
  key: 'materialPurchases' as const,
  label: 'Material',
  dot: 'bg-violet-500',
  bar: 'bg-violet-500'
}, {
  key: 'operatingExpenses' as const,
  label: 'Operativos',
  dot: 'bg-warning',
  bar: 'bg-warning'
}])

const axisTicks = computed(() => [1, 0.75, 0.5, 0.25, 0].map(ratio => ({
  ratio,
  label: dashboardCompactCurrency(maximum.value * ratio)
})))

function barHeight(value: number) {
  if (value <= 0 || maximum.value <= 0) return '0%'
  return `${Math.max((value / maximum.value) * 100, 2)}%`
}

function dayLabel(day: ChartMovement) {
  return `${day.label}: ventas ${dashboardCurrency.format(day.sales)}, compras de material ${dashboardCurrency.format(day.materialPurchases)}, gastos operativos ${dashboardCurrency.format(day.operatingExpenses)}`
}
</script>

<template>
  <UCard :ui="{ header: 'pb-3', body: 'pt-4' }">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            Venta y costo por {{ annual ? 'mes' : 'semana' }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ hoveredDay ? hoveredDay.label : annual ? 'Cuánto se vendió y cuánto se gastó en material y operación.' : 'Totales de lunes a domingo, incluyendo solo los días transcurridos del mes.' }}
          </p>
        </div>

        <dl class="flex flex-wrap gap-x-5 gap-y-2">
          <div v-for="serie in series" :key="serie.key" class="min-w-24">
            <dt class="flex items-center gap-1.5 text-xs text-muted">
              <span class="size-2 rounded-full" :class="serie.dot" />
              {{ serie.label }}
            </dt>
            <dd class="mt-0.5 text-sm font-semibold tabular-nums text-highlighted">
              {{ dashboardCompactCurrency(hoveredDay ? hoveredDay[serie.key] : totals[serie.key]) }}
            </dd>
          </div>
          <div class="min-w-24 border-l border-default pl-5">
            <dt class="text-xs text-muted">
              Resultado
            </dt>
            <dd
              class="mt-0.5 text-sm font-semibold tabular-nums"
              :class="(hoveredDay ? hoveredDay.netProfit : totals.netProfit) < 0 ? 'text-error' : 'text-success'"
            >
              {{ dashboardCompactCurrency(hoveredDay ? hoveredDay.netProfit : totals.netProfit) }}
            </dd>
          </div>
        </dl>
      </div>
    </template>

    <p v-if="!annual && hasMovements" class="mb-3 flex items-center gap-2 text-xs text-muted">
      <span class="relative h-0.5 w-6 bg-primary" aria-hidden="true">
        <span class="absolute -top-1 left-2 size-2.5 rounded-full border-2 border-primary bg-default" />
      </span>
      Tendencia de ventas semanales
    </p>

    <div v-if="hasMovements" class="flex gap-3">
      <div class="flex h-64 w-14 shrink-0 flex-col justify-between text-right text-[10px] leading-none text-dimmed tabular-nums">
        <span v-for="tick in axisTicks" :key="tick.ratio">{{ tick.label }}</span>
      </div>

      <div class="relative min-w-0 flex-1">
        <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 h-64">
          <div
            v-for="tick in axisTicks"
            :key="tick.ratio"
            class="absolute inset-x-0 border-t"
            :class="tick.ratio === 0 ? 'border-default' : 'border-default/50'"
            :style="{ top: `${(1 - tick.ratio) * 100}%` }"
          />
        </div>

        <div class="overflow-x-auto pb-1" @mouseleave="hoveredDate = null">
          <div class="relative grid w-max min-w-full items-start" :style="columns">
            <template v-if="!annual">
              <svg
                class="pointer-events-none absolute inset-x-0 top-1 z-10 h-64 w-full overflow-visible text-primary"
                viewBox="0 0 1000 256"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  :points="trendLine"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
              <span
                v-for="point in trendPoints"
                :key="point.date"
                class="pointer-events-none absolute z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-default"
                :style="{ left: `${point.x}%`, top: `${point.y + 4}px` }"
                aria-hidden="true"
              />
            </template>
            <div
              v-for="day in movements"
              :key="day.date"
              class="group flex min-w-0 flex-col rounded-md px-0.5 pt-1 transition-colors hover:bg-elevated/60"
              :aria-label="dayLabel(day)"
              role="img"
              tabindex="0"
              @focus="hoveredDate = day.date"
              @blur="hoveredDate = null"
              @mouseenter="hoveredDate = day.date"
            >
              <div class="flex h-64 items-end justify-center gap-0.5">
                <div
                  v-for="serie in series"
                  :key="serie.key"
                  class="w-3 rounded-t-[3px] transition-opacity"
                  :class="[serie.bar, hoveredDate && hoveredDate !== day.date ? 'opacity-35' : 'opacity-90']"
                  :style="{ height: barHeight(day[serie.key]) }"
                />
              </div>
              <span
                class="mt-2 text-center text-[10px] tabular-nums transition-colors"
                :class="hoveredDate === day.date ? 'font-medium text-highlighted' : 'text-dimmed'"
              >{{ day.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UEmpty
      v-else
      icon="i-lucide-chart-column"
      title="Sin movimientos en este periodo"
      :description="`La tendencia ${annual ? 'mensual' : 'semanal'} aparecerá cuando se registren ventas, compras o gastos.`"
      class="h-72"
    />
  </UCard>
</template>
