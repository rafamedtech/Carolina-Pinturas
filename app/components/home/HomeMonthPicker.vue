<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import { formatMonth } from '~/utils/datetime'

const selectedMonth = defineModel<DateValue>({ required: true })
const props = withDefaults(defineProps<{ type?: 'month' | 'year' }>(), { type: 'month' })
const open = ref(false)

const label = computed(() => {
  if (props.type === 'year') return String(selectedMonth.value.year)
  const start = new CalendarDate(selectedMonth.value.year, selectedMonth.value.month, 1)
  return formatMonth(start.toString())
})

watch(selectedMonth, () => {
  open.value = false
})
watch(() => props.type, () => {
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
        :key="type"
        v-model="selectedMonth"
        :type="type"
        locale="es-MX"
        class="p-2"
      />
    </template>
  </UPopover>
</template>
