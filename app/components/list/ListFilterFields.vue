<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { ListFilterDefinition, ListFilterValue, ListFilterValues } from '~/types/list'

defineProps<{ fields: ListFilterDefinition[] }>()
const values = defineModel<ListFilterValues>({ required: true })

function update(key: string, value: ListFilterValue) {
  values.value = { ...values.value, [key]: value }
}
function dateValue(value: ListFilterValue | undefined) {
  try {
    return typeof value === 'string' && value ? parseDate(value) : undefined
  } catch {
    return undefined
  }
}
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField
      v-for="field in fields"
      :key="field.key"
      :name="field.key"
      :label="field.type === 'checkbox' ? undefined : field.label"
    >
      <USelect
        v-if="field.type === 'select'"
        :model-value="String(values[field.key] ?? field.defaultValue)"
        :items="field.items"
        :aria-label="field.label"
        class="w-full"
        @update:model-value="update(field.key, String($event))"
      />
      <UCheckbox
        v-else-if="field.type === 'checkbox'"
        :model-value="Boolean(values[field.key] ?? field.defaultValue)"
        :label="field.label"
        @update:model-value="update(field.key, $event === true)"
      />
      <OrdersOrderDatePicker
        v-else
        :model-value="dateValue(values[field.key] ?? field.defaultValue)"
        :placeholder="field.label"
        @update:model-value="update(field.key, $event?.toString() || '')"
      />
    </UFormField>
  </div>
</template>
