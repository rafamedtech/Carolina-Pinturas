<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { formatDate, MEXICO_TIME_ZONE } from '~/utils/datetime'

defineProps<{
  disabled?: boolean
  placeholder?: string
}>()

const selectedDate = defineModel<DateValue | undefined>({ required: true })

function formatValue(value: DateValue) {
  return formatDate(value.toString())
}
</script>

<template>
  <CalendarDatePicker
    v-model="selectedDate"
    :time-zone="MEXICO_TIME_ZONE"
    :format-value="formatValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :close-on-select="false"
    icon="i-lucide-calendar"
    block
    class="justify-start"
  />
</template>
