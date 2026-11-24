<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { useMediaQuery } from '@vueuse/core'
import type { OrderDateRange } from '~/types/orders'
import { dateFilterPresets } from '~/utils/dateFilterPresets'
import { formatDateRange, MEXICO_TIME_ZONE } from '~/utils/datetime'

withDefaults(defineProps<{ subject?: string }>(), { subject: 'pedidos' })

const selectedRange = defineModel<OrderDateRange | null>({ required: true })
const wideScreen = useMediaQuery('(min-width: 48rem)')

function formatRange(start: DateValue, end: DateValue) {
  return formatDateRange(start.toString(), end.toString())
}
</script>

<template>
  <CalendarRangePicker
    v-model="selectedRange"
    :time-zone="MEXICO_TIME_ZONE"
    :format-range="formatRange"
    :presets="dateFilterPresets"
    :number-of-months="wideScreen ? 2 : 1"
    clear-label="Limpiar filtro"
    class="w-full min-w-0 justify-start sm:w-auto"
    :ui="{ label: 'text-start max-sm:whitespace-normal' }"
    :aria-label="selectedRange?.start && selectedRange.end
      ? `Rango de fechas: ${formatRange(selectedRange.start, selectedRange.end)}`
      : `Filtrar ${subject} por rango de fechas`"
  />
</template>
