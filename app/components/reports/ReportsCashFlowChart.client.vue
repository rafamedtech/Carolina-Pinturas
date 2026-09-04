<script setup lang="ts">
import type { ReportDailyMovement } from '~/types/reports'
import { dashboardCompactCurrency, dashboardCurrency } from '~/utils/dashboardFormatters'

const props = defineProps<{
  data: ReportDailyMovement[]
}>()

const totals = computed(() => props.data.reduce((result, day) => ({
  sales: result.sales + day.sales,
  collections: result.collections + day.collections,
  expenses: result.expenses + day.expenses
}), { sales: 0, collections: 0, expenses: 0 }))

const maximum = computed(() => Math.max(
  ...props.data.flatMap(day => [day.sales, day.collections, day.expenses]),
  0
))
const hasMovements = computed(() => maximum.value > 0)

const hoveredDate = shallowRef<string | null>(null)
const hoveredDay = computed(() => props.data.find(day => day.date === hoveredDate.value) ?? null)

const series = computed(() => [{
  key: 'sales' as const,
  label: 'Ventas',
  dot: 'bg-primary',
  bar: 'bg-primary'
}, {
  key: 'collections' as const,
  label: 'Cobros',
  dot: 'bg-success',
  bar: 'bg-success'
}, {
  key: 'expenses' as const,
  label: 'Gastos',
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

function dayLabel(day: ReportDailyMovement) {
  return `${day.label}: ventas ${dashboardCurrency.format(day.sales)}, cobros ${dashboardCurrency.format(day.collections)}, gastos ${dashboardCurrency.format(day.expenses)}`
}
</script>

<template>
  <UCard :ui="{ header: 'pb-3', body: 'pt-4' }">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            Movimiento diario
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ hoveredDay ? hoveredDay.label : 'Ritmo de venta y liquidez a lo largo del mes.' }}
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
        </dl>
      </div>
    </template>

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
          <div class="flex min-w-max items-end gap-1.5">
            <div
              v-for="day in data"
              :key="day.date"
              class="group flex w-7 flex-col rounded-md px-0.5 pt-1 transition-colors hover:bg-elevated/60"
              :aria-label="dayLabel(day)"
              role="img"
              @mouseenter="hoveredDate = day.date"
            >
              <div class="flex h-64 items-end justify-center gap-0.5">
                <div
                  v-for="serie in series"
                  :key="serie.key"
                  class="w-1.5 rounded-t-[3px] transition-opacity"
                  :class="[serie.bar, hoveredDate && hoveredDate !== day.date ? 'opacity-35' : 'opacity-90']"
                  :style="{ height: barHeight(day[serie.key]) }"
                />
              </div>
              <span
                class="mt-2 text-center text-[10px] tabular-nums transition-colors"
                :class="hoveredDate === day.date ? 'font-medium text-highlighted' : 'text-dimmed'"
              >{{ day.label.split(' ')[0] }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <UEmpty
      v-else
      icon="i-lucide-chart-column"
      title="Sin movimientos en este periodo"
      description="La tendencia diaria aparecerá cuando se registren ventas, cobros o gastos."
      class="h-72"
    />
  </UCard>
</template>
