<script setup lang="ts">
import type { reportWeeks } from '~/utils/reportPeriods'
import { reportCurrency, reportDailyAverage } from '~/utils/reportPeriods'
import { formatDateRange, formatMonth } from '~/utils/datetime'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ weeks: ReturnType<typeof reportWeeks>, annual?: boolean }>()
const maximum = computed(() => Math.max(1, ...props.weeks.map(week => week.sales)))
const hasSales = computed(() => props.weeks.some(week => week.sales !== 0 || week.orderCount > 0))
</script>

<template>
  <UEmpty v-if="!weeks.length" :title="annual ? 'Sin actividad en este periodo' : 'Sin días transcurridos'" icon="i-lucide-calendar" />
  <UEmpty
    v-else-if="!hasSales"
    title="Sin ventas en este periodo"
    :description="`Aquí podrás comparar las ventas de cada ${annual ? 'mes' : 'semana'} cuando se registren pedidos.`"
    icon="i-lucide-chart-no-axes-column"
  />
  <figure v-else :aria-label="annual ? 'Ventas totales por mes' : 'Ventas totales por semana'">
    <div class="space-y-5">
      <div v-for="(week, index) in weeks" :key="week.start" class="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_2fr] sm:gap-5">
        <div>
          <p class="text-sm font-medium text-highlighted">
            {{ annual ? formatMonth(week.start) : `Semana ${index + 1}` }}
            <span v-if="!annual && week.days < 7" class="ml-1 text-xs font-normal text-muted">· {{ week.days }} {{ week.days === 1 ? 'día' : 'días' }}</span>
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ formatDateRange(week.start, week.end) }}
          </p>
        </div>
        <div>
          <div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span class="text-sm font-semibold tabular-nums text-highlighted">{{ reportCurrency.format(week.sales) }}</span>
            <span class="text-xs tabular-nums text-muted">{{ dashboardNumber.format(week.orderCount) }} {{ week.orderCount === 1 ? 'venta' : 'ventas' }}</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-elevated" aria-hidden="true">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${Math.max(0, week.sales) / maximum * 100}%` }" />
          </div>
          <p class="mt-2 text-xs tabular-nums text-muted">
            {{ reportCurrency.format(reportDailyAverage(week.sales, week.days)) }} / día
          </p>
        </div>
      </div>
    </div>
    <figcaption class="mt-5 border-t border-default pt-3 text-xs text-muted">
      {{ annual ? 'Cada barra muestra la venta total de un mes. El mes en curso incluye solo los días transcurridos; los meses futuros no se incluyen. Se ocultan los bloques de seis o más meses consecutivos sin actividad.' : 'Cada barra muestra la venta total de una semana, de lunes a domingo. Las semanas parciales incluyen solo los días transcurridos del mes.' }}
    </figcaption>
  </figure>
</template>
