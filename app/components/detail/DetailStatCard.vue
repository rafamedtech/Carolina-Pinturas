<script setup lang="ts">
defineProps<{ title: string, icon?: string, value?: string | number, unit?: string, loading?: boolean, valueColor?: 'primary' | 'neutral' }>()
</script>

<template>
  <UPageCard
    :title="title"
    :icon="icon"
    variant="subtle"
    :ui="{ container: 'gap-y-2 p-3 sm:p-4', title: 'text-xs font-normal text-muted uppercase' }"
  >
    <USkeleton v-if="loading" class="h-8 w-24 max-w-full" />
    <div v-else class="min-w-0">
      <span class="text-2xl font-semibold break-words tabular-nums" :class="valueColor === 'primary' ? 'text-primary' : 'text-highlighted'">{{ value ?? '—' }}</span>
      <span v-if="unit" class="ml-1 text-xs text-muted">{{ unit }}</span>
    </div>
    <slot />
  </UPageCard>
</template>
