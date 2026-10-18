<script setup lang="ts">
defineProps<{
  placeholder?: string
  hasActiveFilters?: boolean
}>()

const search = defineModel<string>('search', { required: true })
const emit = defineEmits<{ clear: [] }>()

defineSlots<{
  filters(): unknown
  actions(): unknown
}>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
      <UInput
        v-if="placeholder"
        v-model="search"
        icon="i-lucide-search"
        :placeholder="placeholder"
        :aria-label="placeholder"
        class="w-full sm:w-80"
      />
      <slot name="filters" />
      <UButton
        v-if="hasActiveFilters"
        label="Quitar filtros"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        class="w-full justify-center sm:w-auto"
        @click="emit('clear')"
      />
    </div>
    <div v-if="$slots.actions" class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <slot name="actions" />
    </div>
  </div>
</template>
