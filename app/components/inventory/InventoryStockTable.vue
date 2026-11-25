<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { purchaseMoney } from '~/utils/purchaseFormat'
import type { InventoryStock } from '#shared/types/inventory'

const props = defineProps<{ rows: InventoryStock[], admin?: boolean }>()
const emit = defineEmits<{ minimum: [row: InventoryStock], kardex: [row: InventoryStock] }>()
const table = useTemplateRef('table')
defineExpose({ getColumns: () => table.value?.getColumns() ?? [] })
const UButton = resolveComponent('UButton')
function unitCost(row: InventoryStock) {
  const currency = row.costCurrency || 'MXN'
  return row.unitCost ? `${purchaseMoney(Number(row.unitCost), currency)} ${currency}` : 'Sin costo'
}

const numeric = { class: { th: 'text-right', td: 'text-right tabular-nums' } }
const columns = computed<TableColumn<InventoryStock>[]>(() => [
  { id: 'product', accessorFn: row => row.name, header: 'Producto', cell: ({ row }) => h('div', [h('p', { class: 'font-medium text-highlighted' }, row.original.name), h('p', { class: 'text-xs text-muted' }, `${row.original.code} · ${row.original.unit || 'Unidad'}`)]) },
  { accessorKey: 'warehouse', header: 'Almacén' },
  { id: 'quantity', accessorFn: row => Number(row.quantity), header: 'Existencia física', meta: numeric, cell: ({ row }) => row.original.quantity },
  { id: 'reserved', accessorFn: row => Number(row.reserved), header: 'Reservado', meta: numeric, cell: ({ row }) => row.original.reserved },
  { id: 'available', accessorFn: row => Number(row.available), header: 'Disponible', meta: numeric, cell: ({ row }) => h('div', { class: row.original.low ? 'font-semibold text-warning' : 'font-semibold text-primary' }, [row.original.available, row.original.low ? h('span', { class: 'block text-xs' }, 'Bajo mínimo') : null]) },
  {
    id: 'cost',
    accessorFn: row => row.unitCost == null ? undefined : Number(row.unitCost),
    header: 'Costo unitario',
    sortUndefined: 'last',
    sortingFn: (a, b, id) => (a.original.costCurrency || 'MXN').localeCompare(b.original.costCurrency || 'MXN')
      || a.getValue<number>(id) - b.getValue<number>(id),
    meta: numeric,
    cell: ({ row }) => unitCost(row.original)
  },
  { id: 'minimum', accessorFn: row => Number(row.minimum), header: 'Mínimo', meta: numeric, cell: ({ row }) => row.original.minimum },
  { id: 'actions', header: 'Acciones', cell: ({ row }) => h('div', { class: 'flex justify-end gap-1' }, [
    h(UButton, { label: 'Kardex', size: 'sm', variant: 'ghost', color: 'neutral', onClick: () => emit('kardex', row.original) }),
    props.admin ? h(UButton, { label: 'Mínimo', size: 'sm', variant: 'ghost', onClick: () => emit('minimum', row.original) }) : null
  ]) }
])
</script>

<template>
  <ListTable
    ref="table"
    :data="rows"
    :columns="columns"
    :get-row-id="row => `${row.productId}:${row.warehouseId}`"
    empty="Sin existencias para estos filtros. Crea un almacén y registra el conteo inicial."
  >
    <template #record="{ row }">
      <ListRecordCard
        :title="row.name"
        :eyebrow="`${row.code} · ${row.unit || 'Unidad'}`"
        :fields="[
          { label: 'Almacén', value: row.warehouse, fullWidth: true },
          { label: 'Existencia física', value: row.quantity },
          { label: 'Reservado', value: row.reserved },
          { label: 'Costo unitario', value: unitCost(row) },
          { label: 'Mínimo', value: row.minimum }
        ]"
        summary-label="Disponible"
        :summary-value="row.available"
        summary-color="primary"
      >
        <template v-if="row.low" #trailing>
          <UBadge color="warning" variant="soft" label="Bajo mínimo" />
        </template>
        <template #footer>
          <div class="flex flex-wrap justify-end gap-2">
            <AppButton
              label="Kardex"
              size="sm"
              intent="quiet"
              @click="emit('kardex', row)"
            />
            <AppButton
              v-if="admin"
              label="Mínimo"
              size="sm"
              intent="quiet"
              color="primary"
              @click="emit('minimum', row)"
            />
          </div>
        </template>
      </ListRecordCard>
    </template>
  </ListTable>
</template>
