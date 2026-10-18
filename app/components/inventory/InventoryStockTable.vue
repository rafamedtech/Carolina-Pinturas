<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InventoryStock } from '#shared/types/inventory'

const props = defineProps<{ rows: InventoryStock[], admin?: boolean }>()
const emit = defineEmits<{ minimum: [row: InventoryStock], kardex: [row: InventoryStock] }>()
const UButton = resolveComponent('UButton')
const columns = computed<TableColumn<InventoryStock>[]>(() => [
  { id: 'product', header: 'Producto', cell: ({ row }) => h('div', [h('p', { class: 'font-medium text-highlighted' }, row.original.name), h('p', `${row.original.code} · ${row.original.unit || 'Unidad'}`)]) },
  { accessorKey: 'warehouse', header: 'Almacén' },
  { accessorKey: 'quantity', header: 'Existencia física' },
  { accessorKey: 'reserved', header: 'Reservado' },
  { accessorKey: 'available', header: 'Disponible', cell: ({ row }) => h('div', { class: row.original.low ? 'font-semibold text-warning' : 'font-semibold text-primary' }, [row.original.available, row.original.low ? h('span', { class: 'block text-xs' }, 'Bajo mínimo') : null]) },
  { id: 'cost', header: 'Costo unitario', cell: ({ row }) => row.original.unitCost ? `${row.original.unitCost} ${row.original.costCurrency}` : 'Sin costo' },
  { accessorKey: 'minimum', header: 'Mínimo' },
  { id: 'actions', header: 'Acciones', cell: ({ row }) => h('div', { class: 'flex justify-end gap-1' }, [
    h(UButton, { label: 'Kardex', size: 'sm', variant: 'ghost', color: 'neutral', onClick: () => emit('kardex', row.original) }),
    props.admin ? h(UButton, { label: 'Mínimo', size: 'sm', variant: 'ghost', onClick: () => emit('minimum', row.original) }) : null
  ]) }
])
</script>

<template>
  <ListTable :data="rows" :columns="columns" empty="Sin existencias para estos filtros. Crea un almacén y registra el conteo inicial." />
</template>
