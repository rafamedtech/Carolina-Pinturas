<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import { formatDateRange } from '~/utils/datetime'

const selectedMonth = defineModel<DateValue>({ required: true })
const open = ref(false)

const label = computed(() => {
  const start = new CalendarDate(selectedMonth.value.year, selectedMonth.value.month, 1)
  const end = start.add({ months: 1 }).subtract({ days: 1 })
  return formatDateRange(start.toString(), end.toString())
})

watch(selectedMonth, () => {
  open.value = false
})
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end' }">
    <UButton
      :label="label"
      icon="i-lucide-calendar-days"
      color="neutral"
      variant="outline"
      class="capitalize"
    />

    <template #content>
      <UCalendar
        v-model="selectedMonth"
        type="month"
        locale="es-MX"
        class="p-2"
      />
    </template>
  </UPopover>
</template>
