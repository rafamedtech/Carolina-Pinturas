<script setup lang="ts">
import { DateFormatter } from '@internationalized/date'
import type { OrderDateRange } from '~/types/orders'
import { MEXICO_TIME_ZONE } from '~/utils/datetime'

const selectedRange = defineModel<OrderDateRange | null>({ required: true })

const open = shallowRef(false)
const draftRange = ref<OrderDateRange | null>(selectedRange.value)
const formatter = new DateFormatter('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: MEXICO_TIME_ZONE
})

const label = computed(() => {
  const start = selectedRange.value?.start
  const end = selectedRange.value?.end

  if (!start || !end) return 'Filtrar por fecha'

  const formattedStart = formatter.format(start.toDate(MEXICO_TIME_ZONE))
  if (start.compare(end) === 0) return formattedStart

  return `${formattedStart} – ${formatter.format(end.toDate(MEXICO_TIME_ZONE))}`
})

watch(selectedRange, (value) => {
  draftRange.value = value
})

function applyRange(value: OrderDateRange) {
  selectedRange.value = value
  open.value = false
}

function clearRange() {
  draftRange.value = null
  selectedRange.value = null
  open.value = false
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start' }">
    <UButton
      :label="label"
      icon="i-lucide-calendar-range"
      color="neutral"
      variant="outline"
      class="w-full justify-start sm:w-auto"
      :aria-label="selectedRange ? `Rango de fechas: ${label}` : 'Filtrar pedidos por rango de fechas'"
    />

    <template #content>
      <div class="max-w-[calc(100vw-2rem)] overflow-x-auto p-2">
        <UCalendar
          v-model="draftRange"
          range
          :number-of-months="2"
          @update:valid-model-value="applyRange"
        />

        <div class="mt-2 flex justify-end border-t border-default pt-2">
          <UButton
            label="Limpiar filtro"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="!selectedRange"
            @click="clearRange"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
