<script setup lang="ts">
defineProps<{
  fields: ReadonlyArray<{ key?: string, label: string, value?: string | number | null, fullWidth?: boolean }>
  loading?: boolean
}>()
</script>

<template>
  <dl class="grid grid-cols-2 gap-4" :aria-busy="loading || undefined">
    <div
      v-for="field in fields"
      :key="field.key ?? field.label"
      class="min-w-0"
      :class="{ 'col-span-2': field.fullWidth }"
    >
      <dt class="text-sm text-muted">
        {{ field.label }}
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
