<script setup lang="ts">
import type { InventoryWarehouse } from '#shared/types/inventory'
import { inventoryTypes } from '#shared/schemas/inventory'

withDefaults(defineProps<{ warehouses: InventoryWarehouse[], showDates?: boolean, showType?: boolean, showLow?: boolean }>(), { showDates: false, showType: false, showLow: false })
const search = defineModel<string>('search', { default: '' })
const warehouse = defineModel<string>('warehouse', { default: '' })
const type = defineModel<string>('type', { default: '' })
const from = defineModel<string>('from', { default: '' })
const to = defineModel<string>('to', { default: '' })
const low = defineModel<boolean>('low', { default: false })
const warehouseSelect = computed({ get: () => warehouse.value || 'all', set: (value: string) => {
  warehouse.value = value === 'all' ? '' : value
} })
const typeSelect = computed({ get: () => type.value || 'all', set: (value: string) => {
  type.value = value === 'all' ? '' : value
} })
</script>

<template>
  <div class="flex flex-wrap items-end gap-3">
    <UFormField label="Buscar" class="min-w-48 flex-1">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Código o producto"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Almacén">
      <USelect v-model="warehouseSelect" :items="[{ label: 'Todos los almacenes', value: 'all' }, ...warehouses.map(w => ({ label: w.name, value: w.id }))]" class="min-w-48" />
    </UFormField>
    <UFormField v-if="showType" label="Movimiento">
      <USelect v-model="typeSelect" :items="[{ label: 'Todos', value: 'all' }, ...inventoryTypes.map(value => ({ label: value.replaceAll('_', ' '), value }))]" />
    </UFormField>
    <UFormField v-if="showDates" label="Desde">
      <PurchasesPurchaseDate v-model="from" />
    </UFormField>
    <UFormField v-if="showDates" label="Hasta">
      <PurchasesPurchaseDate v-model="to" />
    </UFormField>
    <UButton
      v-if="showDates && (from || to)"
      label="Limpiar fechas"
      variant="ghost"
      color="neutral"
      @click="from = ''; to = ''"
    />
    <UCheckbox
      v-if="showLow"
      v-model="low"
      label="Bajo mínimo"
      class="pb-3"
    />
  </div>
</template>
