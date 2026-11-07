<script setup lang="ts">
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{
  label: string
  current: number
  previous: number
  currentLabel: string
  previousLabel: string
  change: number | null
}>()
const scale = computed(() => {
  const minimum = Math.min(0, props.current, props.previous)
  const maximum = Math.max(0, props.current, props.previous)
  const range = maximum - minimum || 1
  return { minimum, range, zero: -minimum / range * 100 }
})
const bars = computed(() => [
  { label: 'Mes seleccionado', value: props.current, amount: props.currentLabel, color: 'bg-primary' },
  { label: 'Mes anterior', value: props.previous, amount: props.previousLabel, color: 'bg-neutral-400 dark:bg-neutral-500' }
].map(bar => ({
  ...bar,
  style: {
    left: `${(Math.min(0, bar.value) - scale.value.minimum) / scale.value.range * 100}%`,
    width: `${Math.abs(bar.value) / scale.value.range * 100}%`
  }
})))
</script>

<template>
  <figure class="min-w-0 rounded-lg border border-default p-4" :aria-label="`${label}: promedio diario`">
    <figcaption class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="text-sm font-medium text-highlighted">
        {{ label }}
      </h3>
      <span class="text-xs tabular-nums text-muted">
        {{ change === null ? 'Sin base de comparación' : `${change > 0 ? '+' : ''}${dashboardNumber.format(change)}% vs. anterior` }}
      </span>
    </figcaption>
    <div class="space-y-3">
      <div v-for="bar in bars" :key="bar.label">
        <div class="mb-1.5 flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs">
          <span class="text-muted">{{ bar.label }}</span>
          <span class="font-medium tabular-nums" :class="bar.value < 0 ? 'text-error' : 'text-highlighted'">{{ bar.amount }} / día</span>
        </div>
        <div class="relative h-2 rounded-full bg-elevated" aria-hidden="true">
          <div class="absolute h-full rounded-full" :class="bar.color" :style="bar.style" />
          <span v-if="scale.minimum < 0" class="absolute -top-0.5 h-3 border-l border-muted" :style="{ left: `${scale.zero}%` }" />
        </div>
      </div>
    </div>
    <p v-if="scale.minimum < 0" class="mt-2 text-xs text-muted">
      Los valores negativos se muestran a la izquierda del cero.
    </p>
  </figure>
</template>
