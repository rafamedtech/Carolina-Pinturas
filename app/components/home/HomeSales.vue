<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SalesOrderListItem, SalesOrderListResponse } from '~/types/orders'

const NuxtLink = resolveComponent('NuxtLink')
const OrderStatusBadge = resolveComponent('OrdersOrderStatusBadge')
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const { data, status, error, refresh } = await useFetch<SalesOrderListResponse>('/api/orders', {
  query: { page_size: 10 },
  lazy: true
})

const orders = computed(() => data.value?.results || [])
const columns: TableColumn<SalesOrderListItem>[] = [{
  accessorKey: 'number',
  header: 'Pedido',
  cell: ({ row }) => h(
    NuxtLink,
    {
      to: `/ventas/${encodeURIComponent(row.original.id)}`,
      class: 'font-medium text-primary hover:underline'
    },
    () => row.original.number
  )
}, {
  accessorKey: 'orderDate',
  header: 'Fecha',
  cell: ({ row }) => row.original.orderDate.split('-').reverse().join('/')
}, {
  id: 'customer',
  header: 'Cliente',
  cell: ({ row }) => row.original.customer.name
}, {
  id: 'status',
  header: 'Estado',
  cell: ({ row }) => h(OrderStatusBadge, { status: row.original.status })
}, {
  accessorKey: 'total',
  header: () => h('div', { class: 'text-right' }, 'Total'),
  cell: ({ row }) => h(
    'div',
    { class: 'text-right font-medium' },
    currency.format(row.original.total)
  )
}]

const message = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible cargar los pedidos.'
)
</script>

<template>
  <UCard :ui="{ header: 'px-4 py-3 sm:px-5', body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-highlighted">
            Pedidos recientes
          </h2>
          <p class="text-sm text-muted">
            Datos guardados en PostgreSQL.
          </p>
        </div>
        <UButton
          label="Ver pedidos"
          to="/ventas"
          color="neutral"
          variant="outline"
          size="sm"
        />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      :description="message"
      class="m-4"
    >
      <template #actions>
        <UButton
          label="Reintentar"
          color="warning"
          variant="soft"
          size="xs"
          @click="() => refresh()"
        />
      </template>
    </UAlert>

    <AppTableSkeleton
      v-else-if="status === 'pending'"
      :cols="columns.length"
      class="m-4"
    />

    <UTable
      v-else
      :data="orders"
      :columns="columns"
      empty="No hay pedidos para mostrar."
      class="shrink-0"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default'
      }"
    />
  </UCard>
</template>
