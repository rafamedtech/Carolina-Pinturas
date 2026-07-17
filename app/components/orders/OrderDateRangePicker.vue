<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { DateFormatter, today } from '@internationalized/date'
import type { OrderDateRange } from '~/types/orders'
import { MEXICO_TIME_ZONE } from '~/utils/datetime'

interface PresetRange {
  label: string
  days?: number
  months?: number
  years?: number
}

const selectedRange = defineModel<OrderDateRange | null>({ required: true })

const open = shallowRef(false)
const draftRange = shallowRef<OrderDateRange | null>(selectedRange.value)
const breakpoints = useBreakpoints(breakpointsTailwind)
const isDesktop = breakpoints.greaterOrEqual('sm')
const formatter = new DateFormatter('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: MEXICO_TIME_ZONE
})
const presetRanges: PresetRange[] = [
  { label: 'Últimos 7 días', days: 7 },
  { label: 'Últimos 14 días', days: 14 },
  { label: 'Últimos 30 días', days: 30 },
  { label: 'Últimos 3 meses', months: 3 },
  { label: 'Últimos 6 meses', months: 6 },
  { label: 'Último año', years: 1 }
]

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

function computePresetRange(range: PresetRange) {
  const end = today(MEXICO_TIME_ZONE)
  return {
    start: end.subtract({
      days: range.days,
      months: range.months,
      years: range.years
    }),
    end
  }
}

function isPresetSelected(range: PresetRange) {
  const start = selectedRange.value?.start
  const end = selectedRange.value?.end
  if (!start || !end) return false

  const preset = computePresetRange(range)
  return start.compare(preset.start) === 0 && end.compare(preset.end) === 0
}

function applyRange(value: OrderDateRange) {
  draftRange.value = value
  selectedRange.value = value
  open.value = false
}

function selectPresetRange(range: PresetRange) {
  applyRange(computePresetRange(range))
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
      <div class="max-w-[calc(100vw-2rem)] overflow-x-auto">
        <div class="flex flex-col sm:flex-row">
          <div class="flex overflow-x-auto border-b border-default p-2 sm:flex-col sm:justify-center sm:border-r sm:border-b-0 sm:py-2">
            <UButton
              v-for="range in presetRanges"
              :key="range.label"
              :label="range.label"
              color="neutral"
              variant="ghost"
              class="shrink-0 justify-start sm:rounded-none sm:px-4"
              :class="isPresetSelected(range) ? 'bg-elevated' : 'hover:bg-elevated/50'"
              @click="selectPresetRange(range)"
            />
          </div>

          <UCalendar
            v-model="draftRange"
            range
            class="p-2"
            :number-of-months="isDesktop ? 2 : 1"
            @update:valid-model-value="applyRange"
          />
        </div>

        <div class="flex justify-end border-t border-default p-2">
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
