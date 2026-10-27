<script setup lang="ts">
import type { InventorySettings, InventoryWarehouse } from '#shared/types/inventory'

withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
const model = defineModel<string>({ default: '' })
const { data, error, status } = useFetch<{ settings: InventorySettings, warehouses: InventoryWarehouse[] }>('/api/orders/inventory-context', { lazy: true, server: false })
const loading = computed(() => status.value === 'idle' || status.value === 'pending')
const items = computed(() => data.value?.warehouses.map(w => ({ label: `${w.code} · ${w.name}`, value: w.id })) ?? [])
</script>

<template>
  <UFormField v-if="loading || data?.settings.enabledAt || error" label="Almacén de inventario interno" :error="error ? 'No se pudieron cargar los almacenes.' : undefined">
    <USelect
      v-model="model"
      :items="items"
      placeholder="Selecciona un almacén"
      :loading="loading"
      :disabled="disabled || loading || Boolean(error)"
      class="w-full"
    />
  </UFormField>
</template>
