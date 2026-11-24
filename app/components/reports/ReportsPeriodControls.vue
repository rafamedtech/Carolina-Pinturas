<script setup lang="ts">
import SharedReportsPeriodControls from '#layers/nuxt-shared/app/components/reports/ReportsPeriodControls.vue'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { formatMonth, MEXICO_TIME_ZONE } from '~/utils/datetime'

const month = defineModel<DateValue>('month', { required: true })
const view = defineModel<'monthly' | 'annual'>('view', { required: true })
const minValue = new CalendarDate(1000, 1, 1)
const maxValue = new CalendarDate(9998, 12, 31)

function formatReportMonth(value: DateValue) {
  return formatMonth(value.toString().slice(0, 10))
}
</script>

<template>
  <SharedReportsPeriodControls
    v-model:month="month"
    v-model:view="view"
    :time-zone="MEXICO_TIME_ZONE"
    :format-month="formatReportMonth"
    :min-value="minValue"
    :max-value="maxValue"
  />
</template>
