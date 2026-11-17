<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { DashboardRecentOrder } from '~/types/dashboard'
import { dashboardCurrency, dashboardDate } from '~/utils/dashboardFormatters'
import { paymentStatusColor, paymentStatusLabel } from '~/utils/orderPayment'

const NuxtLink = resolveComponent('NuxtLink')
const OrderStatusBadge = resolveComponent('OrdersOrderStatusBadge')
const UBadge = resolveComponent('UBadge')

defineProps<{
  orders: DashboardRecentOrder[]
}>()

function orderPath(order: DashboardRecentOrder) {
  return { path: `/ventas/${encodeURIComponent(order.id)}`, query: { returnTo: '/' } }
}

const columns: TableColumn<DashboardRecentOrder>[] = [{
  accessorKey: 'number',
  header: 'Pedido',
  cell: ({ row }) => h(
    NuxtLink,
    {
      'to': orderPath(row.original),
      'class': 'font-medium text-primary hover:underline',
      'aria-label': `Abrir pedido ${row.original.number}`
    },
    () => row.original.number
  )
}, {
  accessorKey: 'orderDate',
  header: 'Fecha',
  cell: ({ row }) => dashboardDate(row.original.orderDate)
}, {
  accessorKey: 'customerName',
  header: 'Cliente',
  cell: ({ row }) => h('span', { class: 'line-clamp-1' }, row.original.customerName)
}, {
  id: 'paymentStatus',
  header: 'Estado de pago',
  cell: ({ row }) => h(UBadge, {
    label: paymentStatusLabel(row.original.paymentStatus),
    color: paymentStatusColor(row.original.paymentStatus),
    variant: 'subtle'
  })
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
    dashboardCurrency.format(row.original.total)
  )
}]
</script>

<template>
  <UCard class="w-full" :ui="{ header: 'px-4 py-4 sm:px-6', body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">
            Últimos pedidos de la semana
          </h2>
        </div>
        <UButton
          label="Todos los pedidos"
          icon="i-lucide-arrow-right"
          trailing
          to="/ventas"
          color="neutral"
          variant="ghost"
          size="sm"
        />
      </div>
    </template>

    <DetailTable
      v-if="orders.length"
      :data="orders"
      :columns="columns"
      :get-row-id="row => row.id"
      class="w-full border-y-0"
      :ui="{
        root: 'w-full',
        base: 'min-w-full border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        separator: 'h-0'
      }"
    >
      <template #record="{ row }">
        <ListRecordCard
          :title="row.number"
          :eyebrow="dashboardDate(row.orderDate)"
          :to="orderPath(row)"
          :fields="[
            { label: 'Cliente', value: row.customerName, fullWidth: true },
            { key: 'payment', label: 'Estado de pago', value: paymentStatusLabel(row.paymentStatus) }
          ]"
          summary-label="Total"
          :summary-value="dashboardCurrency.format(row.total)"
        >
          <template #trailing>
            <OrdersOrderStatusBadge :status="row.status" />
          </template>
          <template #field-value="{ field }">
            <UBadge v-if="field.key === 'payment'" :color="paymentStatusColor(row.paymentStatus)" variant="subtle">
              {{ field.value }}
            </UBadge>
            <template v-else>
              {{ field.value }}
            </template>
          </template>
        </ListRecordCard>
      </template>
    </DetailTable>

    <UEmpty
      v-else
      icon="i-lucide-receipt"
      title="Aún no hay pedidos esta semana"
      description="Crea el primer pedido para comenzar el resumen."
      :actions="[{ label: 'Nuevo pedido', icon: 'i-lucide-plus', to: '/ventas/nuevo-pedido' }]"
      class="py-12"
    />
  </UCard>
</template>
