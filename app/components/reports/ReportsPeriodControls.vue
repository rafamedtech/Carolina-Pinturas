<script setup lang="ts">
import type { DateValue } from '@internationalized/date'

const month = defineModel<DateValue>('month', { required: true })
const view = defineModel<'monthly' | 'annual'>('view', { required: true })
const open = shallowRef(false)
const desktop = useMediaQuery('(min-width: 640px)')
const periods = [
  { label: 'Mensual', value: 'monthly' },
  { label: 'Anual', value: 'annual' }
] as const

watch(month, () => {
  open.value = false
})
watch(desktop, (value) => {
  if (value) open.value = false
})
</script>

<template>
  <div class="hidden items-center gap-2 sm:flex">
    <HomeMonthPicker v-model="month" :type="view === 'annual' ? 'year' : 'month'" />
    <AppButton
      :label="view === 'annual' ? 'Anual' : 'Mensual'"
      icon="i-lucide-calendar-range"
      :color="view === 'annual' ? 'primary' : 'neutral'"
      :variant="view === 'annual' ? 'soft' : 'outline'"
      :aria-pressed="view === 'annual'"
      :aria-label="view === 'annual' ? 'Cambiar a vista mensual' : 'Cambiar a vista anual'"
      @click="view = view === 'annual' ? 'monthly' : 'annual'"
    />
  </div>

  <UPopover v-model:open="open" :content="{ align: 'end' }" class="sm:hidden">
    <AppButton
      icon="i-lucide-sliders-horizontal"
      intent="secondary"
      aria-label="Seleccionar periodo del reporte"
    />
    <template #content>
      <div class="w-72 max-w-[calc(100vw-2rem)] space-y-4 p-4">
        <p class="text-sm font-semibold text-highlighted">
          Periodo del reporte
        </p>
        <div class="flex gap-1 rounded-lg bg-elevated p-1" role="group" aria-label="Tipo de reporte">
          <AppButton
            v-for="period in periods"
            :key="period.value"
            :label="period.label"
            :color="view === period.value ? 'primary' : 'neutral'"
            :variant="view === period.value ? 'subtle' : 'ghost'"
            :aria-pressed="view === period.value"
            size="md"
            class="flex-1 justify-center"
            @click="view = period.value"
          />
        </div>
        <div class="space-y-2">
          <p class="text-xs font-medium text-muted">
            {{ view === 'annual' ? 'Año' : 'Mes' }}
          </p>
          <HomeMonthPicker v-model="month" :type="view === 'annual' ? 'year' : 'month'" />
        </div>
      </div>
    </template>
  </UPopover>
</template>
