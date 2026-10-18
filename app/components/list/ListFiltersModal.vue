<script setup lang="ts">
import type { ListFilterDefinition, ListFilterValues } from '~/types/list'

const props = defineProps<{ fields: ListFilterDefinition[], values: ListFilterValues }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ apply: [values: ListFilterValues] }>()
const draft = ref<ListFilterValues>({})
watch(open, (value) => {
  if (value) draft.value = {
    ...Object.fromEntries(props.fields.map(field => [field.key, field.defaultValue])),
    ...props.values
  }
}, { immediate: true })
function apply() {
  emit('apply', { ...draft.value })
  open.value = false
}
function reset() {
  draft.value = Object.fromEntries(props.fields.map(field => [field.key, field.defaultValue]))
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Más filtros"
    description="Refina los registros que quieres consultar."
    :close="false"
    :ui="{ footer: 'flex-wrap justify-end' }"
  >
    <template #body>
      <ListFilterFields v-model="draft" :fields="fields" />
    </template>
    <template #footer>
      <UButton
        label="Limpiar filtros"
        color="neutral"
        variant="ghost"
        class="sm:mr-auto"
        @click="reset"
      />
      <UButton
        label="Cancelar"
        color="neutral"
        variant="outline"
        @click="open = false"
      />
      <UButton label="Aplicar filtros" icon="i-lucide-check" @click="apply" />
    </template>
  </UModal>
</template>
