<script setup lang="ts">
import { DateFormatter } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'

const selectedMonth = defineModel<DateValue>({ required: true })
const open = ref(false)

const formatter = new DateFormatter('es-MX', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
})

const label = computed(() => formatter.format(selectedMonth.value.toDate('UTC')))

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
