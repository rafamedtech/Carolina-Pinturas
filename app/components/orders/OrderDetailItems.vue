<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SalesOrderItem } from '~/types/orders'

const props = defineProps<{
  items: readonly SalesOrderItem[]
  currencyCode: string
}>()

const currency = computed(() => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: props.currencyCode
}))
const tableItems = computed(() => [...props.items])
const columns: TableColumn<SalesOrderItem>[] = [{
  accessorKey: 'code',
  header: 'Código'
}, {
  accessorKey: 'name',
  header: 'Producto'
}, {
  accessorKey: 'observations',
  header: 'Observaciones',
  cell: ({ row }) => row.original.observations
    ? h('span', { class: 'text-sm' }, row.original.observations)
    : h('span', { class: 'text-muted' }, '—')
}, {
  accessorKey: 'quantity',
  header: () => h('div', { class: 'text-right' }, 'Cantidad'),
  cell: ({ row }) => h('div', { class: 'text-right' }, String(row.original.quantity))
}, {
  id: 'unit',
  header: 'Unidad',
  cell: ({ row }) => row.original.unit.name || row.original.unit.code || '—'
}, {
  accessorKey: 'unitPrice',
  header: () => h('div', { class: 'text-right' }, 'Precio unitario'),
  cell: ({ row }) => h(
    'div',
    { class: 'text-right' },
    currency.value.format(row.original.unitPrice)
  )
}, {
  accessorKey: 'total',
  header: () => h('div', { class: 'text-right' }, 'Total'),
  cell: ({ row }) => h(
    'div',
    { class: 'text-right font-medium' },
    currency.value.format(row.original.total)
  )
}]
</script>

<template>
  <UCard class="shrink-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <h2 class="font-semibold text-highlighted">
        Partidas
      </h2>
    </template>

    <UTable
      :data="tableItems"
      :columns="columns"
      empty="El pedido no tiene partidas."
    />
  </UCard>
</template>
