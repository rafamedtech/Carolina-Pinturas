<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { purchaseMoney } from '~/utils/purchaseFormat'
import type { InventoryStock } from '#shared/types/inventory'

const props = defineProps<{ rows: InventoryStock[], admin?: boolean }>()
const emit = defineEmits<{ minimum: [row: InventoryStock], kardex: [row: InventoryStock] }>()
const table = useTemplateRef('table')
defineExpose({ getColumns: () => table.value?.getColumns() ?? [] })
const UButton = resolveComponent('UButton')
const numeric = { class: { th: 'text-right', td: 'text-right tabular-nums' } }
const columns = computed<TableColumn<InventoryStock>[]>(() => [
  { id: 'product', header: 'Producto', cell: ({ row }) => h('div', [h('p', { class: 'font-medium text-highlighted' }, row.original.name), h('p', { class: 'text-xs text-muted' }, `${row.original.code} · ${row.original.unit || 'Unidad'}`)]) },
  { accessorKey: 'warehouse', header: 'Almacén' },
  { accessorKey: 'quantity', header: 'Existencia física', meta: numeric },
  { accessorKey: 'reserved', header: 'Reservado', meta: numeric },
  { accessorKey: 'available', header: 'Disponible', meta: numeric, cell: ({ row }) => h('div', { class: row.original.low ? 'font-semibold text-warning' : 'font-semibold text-primary' }, [row.original.available, row.original.low ? h('span', { class: 'block text-xs' }, 'Bajo mínimo') : null]) },
  { id: 'cost', header: 'Costo unitario', meta: numeric, cell: ({ row }) => row.original.unitCost ? `${purchaseMoney(Number(row.original.unitCost), row.original.costCurrency || 'MXN')} ${row.original.costCurrency || 'MXN'}` : 'Sin costo' },
  { accessorKey: 'minimum', header: 'Mínimo', meta: numeric },
  { id: 'actions', header: 'Acciones', cell: ({ row }) => h('div', { class: 'flex justify-end gap-1' }, [
    h(UButton, { label: 'Kardex', size: 'sm', variant: 'ghost', color: 'neutral', onClick: () => emit('kardex', row.original) }),
    props.admin ? h(UButton, { label: 'Mínimo', size: 'sm', variant: 'ghost', onClick: () => emit('minimum', row.original) }) : null
  ]) }
])
</script>

<template>
  <DetailTable
    ref="table"
    :data="rows"
    :columns="columns"
    empty="Sin existencias para estos filtros. Crea un almacén y registra el conteo inicial."
  />
</template>
