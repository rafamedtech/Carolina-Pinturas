<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState, VisibilityState } from '@tanstack/table-core'
import OrderListCards from './OrderListCards.vue'
import type { SalesOrderListItem } from '~/types/orders'
import { paymentMethodLabel, paymentStatusColor, paymentStatusLabel } from '~/utils/orderPayment'

const props = withDefaults(defineProps<{
  orders: readonly SalesOrderListItem[]
  loading: boolean
  returnTo: string
  igualacion?: boolean
}>(), {
  igualacion: false
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
const sorting = ref<SortingState>([])
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

function sortableHeader(label: string, align: 'left' | 'right' = 'left') {
  return ({ column }: { column: Column<SalesOrderListItem, unknown> }) => {
    const direction = column.getIsSorted()
    const nextDirection = column.getNextSortingOrder()
    const directionLabel = direction === 'asc'
      ? 'ascendente'
      : direction === 'desc'
        ? 'descendente'
        : 'sin ordenar'
    const nextDirectionLabel = nextDirection === 'asc'
      ? 'ascendente'
      : nextDirection === 'desc'
        ? 'descendente'
        : 'quitar el orden'
    const actionLabel = direction
      ? `Cambiar ${label} a orden ${nextDirectionLabel}`
      : `Ordenar por ${label} ${nextDirectionLabel}`

    return h(UButton, {
      'label': label,
      'color': 'neutral',
      'variant': 'ghost',
      'size': 'sm',
      'class': align === 'right' ? 'w-full justify-end' : undefined,
      'trailingIcon': direction === 'asc'
        ? 'i-lucide-arrow-up'
        : direction === 'desc'
          ? 'i-lucide-arrow-down'
          : 'i-lucide-arrow-up-down',
      'aria-label': `${label}, ${directionLabel}. ${actionLabel}`,
      'title': actionLabel,
      'onClick': () => column.toggleSorting()
    })
  }
}

const igualacionColumn: TableColumn<SalesOrderListItem> = {
  id: 'igualaciones',
  accessorFn: row => (row.partidas ?? [])
    .filter(item => item.isIgualacion)
    .map(item => item.code)
    .join(' '),
  header: sortableHeader('Igualaciones'),
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
  accessorFn: row => paymentStatusLabel(row.paymentStatus),
  header: sortableHeader('Estado de pago'),
  cell: ({ row }) => h(UBadge, {
    color: paymentStatusColor(row.original.paymentStatus),
    label: paymentStatusLabel(row.original.paymentStatus),
    variant: 'subtle'
  })
}

const paymentMethodColumn: TableColumn<SalesOrderListItem> = {
  id: 'paymentMethod',
  accessorFn: row => paymentMethodLabel(row.paymentMethod),
  header: sortableHeader('Método de pago'),
  cell: ({ row }) => paymentMethodLabel(row.original.paymentMethod)
}

const totalColumn: TableColumn<SalesOrderListItem> = {
  accessorKey: 'total',
  header: sortableHeader('Total', 'right'),
  cell: ({ row }) => h(
    'div',
    { class: 'text-right font-medium' },
    currency.format(row.original.total)
  )
}

const numberColumn: TableColumn<SalesOrderListItem> = props.igualacion
  ? {
      accessorKey: 'number',
      header: sortableHeader('Pedido'),
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
      header: sortableHeader('Pedido'),
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
  header: sortableHeader('Fecha'),
  cell: ({ row }) => formatDate(row.original.orderDate)
}, {
  id: 'promisedDate',
  accessorFn: row => row.promisedDate || '',
  header: sortableHeader('Fecha prometida'),
  cell: ({ row }) => formatDate(row.original.promisedDate)
}, {
  id: 'customer',
  accessorFn: row => row.customer.name,
  header: sortableHeader('Cliente'),
  cell: ({ row }) => row.original.customer.name
}, {
  id: 'rfc',
  accessorFn: row => row.customer.rfc || '',
  header: sortableHeader('RFC'),
  cell: ({ row }) => row.original.customer.rfc || '—'
}, {
  accessorKey: 'itemCount',
  header: sortableHeader('Partidas')
}, ...(props.igualacion ? [igualacionColumn] : [paymentStatusColumn, paymentMethodColumn]), {
  id: 'status',
  accessorFn: row => row.status.sortOrder,
  header: sortableHeader('Estado'),
  cell: ({ row }) => h(OrderStatusBadge, { status: row.original.status })
}, ...(props.igualacion ? [] : [totalColumn]), {
  accessorKey: 'createdAt',
  header: sortableHeader('Creado'),
  cell: ({ row }) => formatDateTime(row.original.createdAt)
}, {
  accessorKey: 'updatedAt',
  header: sortableHeader('Última actualización'),
  cell: ({ row }) => formatDateTime(row.original.updatedAt)
}])
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
    <UTable
      v-model:column-visibility="columnVisibility"
      v-model:sorting="sorting"
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
