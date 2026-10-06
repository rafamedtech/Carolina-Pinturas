<script setup lang="ts">
import type { InventorySettings, InventoryWarehouse } from '#shared/types/inventory'

withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
const model = defineModel<string>({ default: '' })
const { data, error } = await useFetch<{ settings: InventorySettings, warehouses: InventoryWarehouse[] }>('/api/orders/inventory-context')
const items = computed(() => data.value?.warehouses.map(w => ({ label: `${w.code} · ${w.name}`, value: w.id })) ?? [])
</script>

<template>
  <UFormField v-if="data?.settings.enabledAt || error" label="Almacén de inventario interno" :error="error ? 'No se pudieron cargar los almacenes.' : undefined">
    <USelect
      v-model="model"
      :items="items"
      placeholder="Selecciona un almacén"
      :disabled="disabled"
      class="w-full"
    />
  </UFormField>
</template>
