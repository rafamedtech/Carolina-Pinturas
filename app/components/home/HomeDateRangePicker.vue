<script setup lang="ts">
import { fromDate, getLocalTimeZone, toCalendarDate, type DateValue } from '@internationalized/date'
import { useMediaQuery } from '@vueuse/core'
import type { Range } from '~/types'
import { dateFilterPresets } from '~/utils/dateFilterPresets'
import { formatDateRange } from '~/utils/datetime'

const selected = defineModel<Range>({ required: true })
const timeZone = getLocalTimeZone()
const wideScreen = useMediaQuery('(min-width: 48rem)')
const range = computed(() => {
  const { start, end } = selected.value
  return {
    start: start ? toCalendarDate(fromDate(start, timeZone)) : undefined,
    end: end ? toCalendarDate(fromDate(end, timeZone)) : undefined
  }
})

function updateRange(value: { start: DateValue | undefined, end: DateValue | undefined } | null) {
  if (!value?.start || !value.end) return
  selected.value = { start: value.start.toDate(timeZone), end: value.end.toDate(timeZone) }
}

function formatRange(start: DateValue, end: DateValue) {
  return formatDateRange(start.toString(), end.toString())
}
</script>

<template>
  <CalendarRangePicker
    :model-value="range"
    :time-zone="timeZone"
    :format-range="formatRange"
    :presets="dateFilterPresets"
    :number-of-months="wideScreen ? 2 : 1"
    modal
    :close-on-select="false"
    :clearable="false"
    placeholder="Seleccionar fechas"
    icon="i-lucide-calendar"
    variant="ghost"
    trailing-icon="i-lucide-chevron-down"
    @update:model-value="updateRange"
  />
</template>
