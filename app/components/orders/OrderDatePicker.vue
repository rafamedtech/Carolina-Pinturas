<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { formatDate } from '~/utils/datetime'

const props = withDefaults(defineProps<{
  disabled?: boolean
  placeholder?: string
}>(), {
  disabled: false,
  placeholder: 'Seleccionar fecha'
})

const selectedDate = defineModel<DateValue | undefined>({ required: true })

const label = computed(() =>
  selectedDate.value
    ? formatDate(selectedDate.value.toString())
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
