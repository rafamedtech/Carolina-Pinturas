<script setup lang="ts">
defineProps<{
  fields: ReadonlyArray<{ key?: string, label: string, value?: string | number | null, fullWidth?: boolean }>
  columns?: 1 | 2 | 3 | 4
  loading?: boolean
}>()
</script>

<template>
  <dl class="grid gap-4" :class="{ 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[columns ?? 2]" :aria-busy="loading || undefined">
    <div
      v-for="field in fields"
      :key="field.key ?? field.label"
      class="min-w-0"
      :class="{ 'col-span-full': field.fullWidth }"
    >
      <dt class="text-sm text-muted">
        <slot name="label" :field="field">
          {{ field.label }}
        </slot>
      </dt>
      <dd class="mt-1 font-medium break-words">
        <USkeleton v-if="loading" class="h-5 w-32 max-w-full" />
        <template v-else>
          <slot name="value" :field="field">
            {{ field.value === undefined || field.value === null || field.value === '' ? '—' : field.value }}
          </slot>
        </template>
      </dd>
    </div>
  </dl>
</template>
