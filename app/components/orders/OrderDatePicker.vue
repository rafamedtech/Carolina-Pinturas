<script setup lang="ts">
import { DateFormatter } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import { MEXICO_TIME_ZONE } from '~/utils/datetime'

const props = withDefaults(defineProps<{
  disabled?: boolean
  placeholder?: string
}>(), {
  disabled: false,
  placeholder: 'Seleccionar fecha'
})

const selectedDate = defineModel<DateValue | undefined>({ required: true })

const formatter = new DateFormatter('es-MX', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: MEXICO_TIME_ZONE
})
const label = computed(() =>
  selectedDate.value
    ? formatter.format(selectedDate.value.toDate(MEXICO_TIME_ZONE))
    : props.placeholder
)
</script>

<template>
  <UPopover :content="{ align: 'start' }">
    <UButton
      :label="label"
      icon="i-lucide-calendar"
      color="neutral"
      variant="outline"
      :disabled="props.disabled"
      block
      class="justify-start"
    />

    <template #content>
      <UCalendar v-model="selectedDate" class="p-2" />
    </template>
  </UPopover>
</template>
