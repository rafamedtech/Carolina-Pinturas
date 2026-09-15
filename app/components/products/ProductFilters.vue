<script setup lang="ts">
import type { DateValue } from '@internationalized/date'

const emit = defineEmits<{ change: [filters: Record<string, string>] }>()
const active = shallowRef('true')
const createdStart = shallowRef<DateValue>()
const createdEnd = shallowRef<DateValue>()
const updatedStart = shallowRef<DateValue>()
const updatedEnd = shallowRef<DateValue>()
const options = [{ label: 'Activos', value: 'true' }, { label: 'Inactivos', value: 'false' }, { label: 'Todos', value: 'all' }]
const filters = computed(() => Object.fromEntries(Object.entries({ active: active.value, created_start: createdStart.value?.toString(), created_end: createdEnd.value?.toString(), updated_start: updatedStart.value?.toString(), updated_end: updatedEnd.value?.toString() }).filter((entry): entry is [string, string] => Boolean(entry[1]))))
function clear() {
  active.value = 'true'
  createdStart.value = createdEnd.value = updatedStart.value = updatedEnd.value = undefined
  emit('change', filters.value)
}
</script>

<template>
  <details class="rounded-lg border border-default p-3">
    <summary class="cursor-pointer text-sm font-medium">
      Filtros de productos
    </summary>
    <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <UFormField label="Estado">
        <USelect v-model="active" :items="options" class="w-full" />
      </UFormField>
      <UFormField label="Creado desde">
        <OrdersOrderDatePicker v-model="createdStart" />
      </UFormField>
      <UFormField label="Creado hasta">
        <OrdersOrderDatePicker v-model="createdEnd" />
      </UFormField>
      <UFormField label="Actualizado desde">
        <OrdersOrderDatePicker v-model="updatedStart" />
      </UFormField>
      <UFormField label="Actualizado hasta">
        <OrdersOrderDatePicker v-model="updatedEnd" />
      </UFormField>
    </div>
    <div class="mt-4 flex gap-3">
      <UButton label="Aplicar filtros" @click="emit('change', filters)" />
      <UButton
        label="Limpiar filtros"
        variant="outline"
        color="neutral"
        @click="clear"
      />
    </div>
  </details>
</template>
