<script setup lang="ts">
import type { ListFilterDefinition, ListFilterValues } from '~/types/list'

const props = defineProps<{ fields: ListFilterDefinition[], values: ListFilterValues }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ apply: [values: ListFilterValues] }>()
const defaults = computed(() => Object.fromEntries(props.fields.map(field => [field.key, field.defaultValue])))
const valuesWithDefaults = computed(() => ({ ...defaults.value, ...props.values }))
</script>

<template>
  <ListFiltersDialog
    v-model:open="open"
    :values="valuesWithDefaults"
    :defaults="defaults"
    @apply="emit('apply', $event)"
  >
    <slot v-if="$slots.default" />
    <template #fields="{ draft, update }">
      <ListFilterFields :model-value="draft" :fields="fields" @update:model-value="update" />
    </template>
  </ListFiltersDialog>
</template>
