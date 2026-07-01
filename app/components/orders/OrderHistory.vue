<script setup lang="ts">
import type { SalesOrderStatusHistoryItem } from '~/types/orders'

defineProps<{
  entries: readonly SalesOrderStatusHistoryItem[]
}>()

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
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
        v-for="entry in entries"
        :key="entry.id"
        class="grid gap-1 border-l-2 border-primary/30 pl-4"
      >
        <p class="font-medium">
          {{ entry.fromStatus ? `${entry.fromStatus.label} → ` : '' }}{{ entry.toStatus.label }}
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
