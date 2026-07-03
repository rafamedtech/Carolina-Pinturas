<script setup lang="ts">
import type { SalesOrderStatusHistoryItem } from '~/types/orders'

defineProps<{
  entries: readonly SalesOrderStatusHistoryItem[]
}>()

function formatDateTime(value: string) {
  return formatMexicoDateTime(value)
}

function minutesSince(entries: readonly SalesOrderStatusHistoryItem[], index: number) {
  if (index === 0) return null

  const entry = entries[index]!
  if (entry.fromStatus?.key === 'borrador' && entry.toStatus.key === 'ingresado') return null

  const previous = entries[index - 1]!
  const diffMs = new Date(entry.changedAt).getTime() - new Date(previous.changedAt).getTime()
  return Math.round(diffMs / 60000)
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-highlighted">
        Historial
      </h2>
    </template>

    <ol class="space-y-4">
      <li
        v-for="(entry, index) in entries"
        :key="entry.id"
        class="grid gap-1 border-l-2 border-primary/30 pl-4"
      >
        <p class="font-medium">
          {{ entry.fromStatus ? `${entry.fromStatus.label} → ` : '' }}{{ entry.toStatus.label }}
          <span v-if="minutesSince(entries, index) !== null" class="font-normal text-xs text-muted">
            ({{ minutesSince(entries, index) }} min)
          </span>
        </p>
        <p v-if="entry.note" class="text-sm">
          {{ entry.note }}
        </p>
        <p class="text-xs text-muted">
          {{ entry.changedBy.name }} · {{ formatDateTime(entry.changedAt) }}
        </p>
      </li>
    </ol>
  </UCard>
</template>
