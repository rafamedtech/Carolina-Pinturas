<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import type { Table, VisibilityState } from '@tanstack/table-core'
import OrderListCards from './OrderListCards.vue'
import type { SalesOrderListItem } from '~/types/orders'
import { paymentMethodLabel, paymentStatusColor, paymentStatusLabel } from '~/utils/orderPayment'

const props = withDefaults(defineProps<{
  orders: readonly SalesOrderListItem[]
  loading: boolean
  returnTo: string
  igualacion?: boolean
  canCustomizeColumns?: boolean
}>(), {
  igualacion: false,
  canCustomizeColumns: false
})

const OrderStatusBadge = resolveComponent('OrdersOrderStatusBadge')
const NuxtLink = resolveComponent('NuxtLink')
const UButton = resolveComponent('UButton')
const UBadge = resolveComponent('UBadge')
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const dateTime = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'short',
  timeStyle: 'short'
})
const tableOrders = computed(() => [...props.orders])
const table = useTemplateRef<{ tableApi: Table<SalesOrderListItem> }>('table')
const columnVisibility = ref<VisibilityState>({
  promisedDate: false,
  rfc: false,
  itemCount: false,
  createdAt: false,
  updatedAt: false
})

const selectedOrder = shallowRef<SalesOrderListItem | null>(null)
const detailOpen = shallowRef(false)

function openOrder(order: SalesOrderListItem) {
  selectedOrder.value = order
  detailOpen.value = true
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return value.split('-').reverse().join('/')
}

function formatDateTime(value: string) {
  return dateTime.format(new Date(value))
}

const igualacionColumn: TableColumn<SalesOrderListItem> = {
  id: 'igualaciones',
  header: 'Igualaciones',
  cell: ({ row }) => {
    const items = (row.original.partidas ?? []).filter(item => item.isIgualacion)
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

const paymentStatusColumn: TableColumn<SalesOrderListItem> = {
  id: 'paymentStatus',
  header: 'Estado de pago',
  cell: ({ row }) => h(UBadge, {
    color: paymentStatusColor(row.original.paymentStatus),
    label: paymentStatusLabel(row.original.paymentStatus),
    variant: 'subtle'
  })
}

const paymentMethodColumn: TableColumn<SalesOrderListItem> = {
  id: 'paymentMethod',
  header: 'Método de pago',
  cell: ({ row }) => paymentMethodLabel(row.original.paymentMethod)
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

const numberColumn: TableColumn<SalesOrderListItem> = props.igualacion
  ? {
      accessorKey: 'number',
      header: 'Pedido',
      cell: ({ row }) => h(
        UButton,
        {
          'variant': 'link',
          'color': 'primary',
          'class': 'p-0 font-medium',
          'aria-label': `Ver pedido ${row.original.number}`,
          'onClick': () => openOrder(row.original)
        },
        () => row.original.number
      )
    }
  : {
      accessorKey: 'number',
      header: 'Pedido',
      cell: ({ row }) => h(
        NuxtLink,
        {
          'to': {
            path: `/ventas/${encodeURIComponent(row.original.id)}`,
            query: { returnTo: props.returnTo }
          },
          'class': 'font-medium text-primary hover:underline',
          'aria-label': `Abrir pedido ${row.original.number}`
        },
        () => row.original.number
      )
    }

const columns = computed<TableColumn<SalesOrderListItem>[]>(() => [numberColumn, {
  accessorKey: 'orderDate',
  header: 'Fecha',
  cell: ({ row }) => formatDate(row.original.orderDate)
}, {
  accessorKey: 'promisedDate',
  header: 'Fecha prometida',
  cell: ({ row }) => formatDate(row.original.promisedDate)
}, {
  id: 'customer',
  header: 'Cliente',
  cell: ({ row }) => row.original.customer.name
}, {
  id: 'rfc',
  header: 'RFC',
  cell: ({ row }) => row.original.customer.rfc || '—'
}, {
  accessorKey: 'itemCount',
  header: 'Partidas'
}, ...(props.igualacion ? [igualacionColumn] : [paymentStatusColumn, paymentMethodColumn]), {
  id: 'status',
  header: 'Estado',
  cell: ({ row }) => h(OrderStatusBadge, { status: row.original.status })
}, ...(props.igualacion ? [] : [totalColumn]), {
  accessorKey: 'createdAt',
  header: 'Creado',
  cell: ({ row }) => formatDateTime(row.original.createdAt)
}, {
  accessorKey: 'updatedAt',
  header: 'Última actualización',
  cell: ({ row }) => formatDateTime(row.original.updatedAt)
}])

const columnLabels: Record<string, string> = {
  number: 'Pedido',
  orderDate: 'Fecha',
  promisedDate: 'Fecha prometida',
  customer: 'Cliente',
  rfc: 'RFC',
  itemCount: 'Partidas',
  igualaciones: 'Igualaciones',
  paymentStatus: 'Estado de pago',
  paymentMethod: 'Método de pago',
  status: 'Estado',
  total: 'Total',
  createdAt: 'Creado',
  updatedAt: 'Última actualización'
}

const columnMenuItems = computed<DropdownMenuItem[]>(() => {
  const visibility = columnVisibility.value

  return table.value?.tableApi
    .getAllColumns()
    .filter(column => column.getCanHide())
    .map(column => ({
      label: columnLabels[column.id] || column.id,
      type: 'checkbox' as const,
      checked: visibility[column.id] ?? column.getIsVisible(),
      onUpdateChecked(checked: boolean) {
        table.value?.tableApi.getColumn(column.id)?.toggleVisibility(checked)
      },
      onSelect(event: Event) {
        event.preventDefault()
      }
    })) || []
})
</script>

<template>
  <OrderListCards
    :orders="orders"
    :loading="loading"
    :igualacion="igualacion"
    :return-to="returnTo"
    @open="openOrder"
  />

  <AppTableSkeleton
    v-if="loading"
    :cols="columns.length"
    class="hidden shrink-0 md:block"
  />

  <template v-else>
    <div v-if="canCustomizeColumns" class="hidden justify-end md:flex">
      <UDropdownMenu
        :items="columnMenuItems"
        :content="{ align: 'end' }"
      >
        <UButton
          label="Columnas"
          icon="i-lucide-columns-3"
          trailing-icon="i-lucide-chevron-down"
          color="neutral"
          variant="outline"
          aria-label="Seleccionar columnas visibles"
        />
      </UDropdownMenu>
    </div>

    <UTable
      ref="table"
      v-model:column-visibility="columnVisibility"
      :data="tableOrders"
      :columns="columns"
      empty="No hay pedidos para mostrar."
      class="hidden shrink-0 md:block"
      :ui="{
        base: 'min-w-full border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        separator: 'h-0'
      }"
    />
  </template>

  <UModal
    v-model:open="detailOpen"
    :title="selectedOrder ? `Pedido ${selectedOrder.number}` : 'Pedido'"
  >
    <template #body>
      <div v-if="selectedOrder" class="flex flex-col gap-4">
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div class="flex flex-col">
            <dt class="text-muted">
              Fecha
            </dt>
            <dd>{{ formatDate(selectedOrder.orderDate) }}</dd>
          </div>
          <div class="flex flex-col">
            <dt class="text-muted">
              Estado
            </dt>
            <dd>
              <OrdersOrderStatusBadge :status="selectedOrder.status" />
            </dd>
          </div>
          <div class="col-span-2 flex flex-col">
            <dt class="text-muted">
              Cliente
            </dt>
            <dd>{{ selectedOrder.customer.name }}</dd>
          </div>
        </dl>

        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-medium">
            Partidas
          </h3>
          <ul class="flex flex-col gap-1">
            <li
              v-for="(item, index) in selectedOrder.partidas ?? []"
              :key="index"
              class="flex flex-col rounded-md border px-3 py-2 text-sm"
              :class="item.isIgualacion
                ? 'border-primary bg-primary/10'
                : 'border-default'"
            >
              <div class="flex items-center gap-2">
                <UBadge
                  v-if="item.isIgualacion"
                  color="primary"
                  variant="solid"
                  size="sm"
                  label="Igualación"
                />
                <span class="font-medium">{{ item.quantity }} x {{ item.code }}</span>
              </div>
              <span class="text-muted">{{ item.name }}</span>
              <span v-if="item.observations" class="text-muted">{{ item.observations }}</span>
            </li>
            <li v-if="!(selectedOrder.partidas ?? []).length" class="text-sm text-muted">
              Sin partidas.
            </li>
          </ul>
        </div>
      </div>
    </template>
    <template #footer>
      <UButton
        v-if="selectedOrder"
        :to="{
          path: `/ventas/${encodeURIComponent(selectedOrder.id)}`,
          query: { returnTo }
        }"
        label="Atender pedido"
        icon="i-lucide-arrow-right"
        trailing
        @click="detailOpen = false"
      />
    </template>
  </UModal>
</template>
