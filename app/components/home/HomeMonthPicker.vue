<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { formatMonth, MEXICO_TIME_ZONE } from '~/utils/datetime'

const props = withDefaults(defineProps<{ type?: 'month' | 'year' }>(), { type: 'month' })
const selectedMonth = defineModel<DateValue>({ required: true })

function formatPeriod(value: DateValue) {
  return props.type === 'year' ? String(value.year) : formatMonth(value.toString().slice(0, 10))
}
</script>

<template>
  <CalendarMonthPicker
    v-model="selectedMonth"
    :type="type"
    :time-zone="MEXICO_TIME_ZONE"
    :format-value="formatPeriod"
    align="end"
    class="capitalize"
  />
</template>
