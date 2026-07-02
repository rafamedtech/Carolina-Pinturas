<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SalesOrderListItem } from '~/types/orders'

const props = withDefaults(defineProps<{
  orders: readonly SalesOrderListItem[]
  loading: boolean
  igualacion?: boolean
}>(), {
  igualacion: false
})

const OrderStatusBadge = resolveComponent('OrdersOrderStatusBadge')
const NuxtLink = resolveComponent('NuxtLink')
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const tableOrders = computed(() => [...props.orders])

function formatDate(value: string | null) {
  if (!value) return '—'
  return value.split('-').reverse().join('/')
}

const igualacionColumn: TableColumn<SalesOrderListItem> = {
  id: 'igualaciones',
  header: 'Igualaciones',
  cell: ({ row }) => {
    const items = row.original.igualacionItems ?? []
    if (!items.length) return h('span', { class: 'text-muted' }, '—')
    return h(
      'div',
      { class: 'flex flex-col gap-0.5' },
      items.map(item => h('span', { class: 'text-sm' }, [
        `${item.quantity} x ${item.code}`,
        item.observations
          ? h('span', { class: 'text-muted' }, ` (${item.observations})`)
          : null
      ]))
    )
  }
}

const itemsColumn: TableColumn<SalesOrderListItem> = {
  id: 'items',
  header: () => h('div', { class: 'text-right' }, 'Partidas'),
  cell: ({ row }) => h('div', { class: 'text-right' }, String(row.original.itemCount))
}

const totalColumn: TableColumn<SalesOrderListItem> = {
  accessorKey: 'total',
  header: () => h('div', { class: 'text-right' }, 'Total'),
  cell: ({ row }) => h(
    'div',
    { class: 'text-right font-medium' },
    currency.format(row.original.total)
  )
}

const columns = computed<TableColumn<SalesOrderListItem>[]>(() => [{
  accessorKey: 'number',
  header: 'Pedido',
  cell: ({ row }) => h(
    NuxtLink,
    {
      'to': `/ventas/${encodeURIComponent(row.original.id)}`,
      'class': 'font-medium text-primary hover:underline',
      'aria-label': `Abrir pedido ${row.original.number}`
    },
    () => row.original.number
  )
}, {
  accessorKey: 'orderDate',
  header: 'Fecha',
  cell: ({ row }) => formatDate(row.original.orderDate)
}, {
  id: 'customer',
  header: 'Cliente',
  cell: ({ row }) => row.original.customer.name
}, props.igualacion ? igualacionColumn : itemsColumn, {
  id: 'status',
  header: 'Estado',
  cell: ({ row }) => h(OrderStatusBadge, { status: row.original.status })
}, ...(props.igualacion ? [] : [totalColumn])])
</script>

<template>
  <UTable
    :data="tableOrders"
    :columns="columns"
    :loading="loading"
    empty="No hay pedidos para mostrar."
    class="shrink-0"
    :ui="{
      base: 'table-fixed border-separate border-spacing-0',
      thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
      tbody: '[&>tr]:last:[&>td]:border-b-0',
      th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
      td: 'border-b border-default',
      separator: 'h-0'
    }"
  >
    <template #loading>
      <div class="flex items-center justify-center gap-2 text-muted" role="status">
        <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-primary" />
        <span>Cargando pedidos…</span>
      </div>
    </template>
  </UTable>
</template>
