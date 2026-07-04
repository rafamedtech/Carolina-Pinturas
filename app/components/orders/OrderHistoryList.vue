<script setup lang="ts">
import type { SalesOrderStatusHistoryItem } from '~/types/orders'

const props = defineProps<{
  entries: readonly SalesOrderStatusHistoryItem[]
  collapseAfter?: number
}>()

const sortedEntries = computed(() =>
  props.entries.map((entry, index) => ({ entry, index })).reverse()
)

function formatDateTime(value: string) {
  return formatMexicoDateTime(value)
}

function minutesSince(index: number) {
  if (index === 0) return null

  const entry = props.entries[index]!
  if (entry.fromStatus?.key === 'borrador' && entry.toStatus.key === 'ingresado') return null

  const previous = props.entries[index - 1]!
  const diffMs = new Date(entry.changedAt).getTime() - new Date(previous.changedAt).getTime()
  return Math.round(diffMs / 60000)
}

function historyNote(entry: SalesOrderStatusHistoryItem, index: number) {
  if (
    index === 0
    && entry.toStatus.key === 'borrador'
    && entry.note?.trim().toLowerCase() === 'pedido creado.'
  ) {
    return 'Cotización creada.'
  }

  return entry.note
}
</script>

<template>
  <ol class="space-y-4">
    <li
      v-for="({ entry, index }, position) in sortedEntries"
      :key="entry.id"
      class="grid gap-1 border-l-2 border-primary/30 pl-4"
      :class="{ 'lg:hidden': collapseAfter !== undefined && position >= collapseAfter }"
    >
      <p class="font-medium">
        {{ entry.fromStatus ? `${entry.fromStatus.label} → ` : '' }}{{ entry.toStatus.label }}
        <span v-if="minutesSince(index) !== null" class="font-normal text-xs text-muted">
          ({{ minutesSince(index) }} min)
        </span>
      </p>
      <p v-if="historyNote(entry, index)" class="text-sm">
        {{ historyNote(entry, index) }}
      </p>
      <p class="text-xs text-muted">
        {{ entry.changedBy.name }} · {{ formatDateTime(entry.changedAt) }}
      </p>
    </li>
  </ol>
</template>
