import { UButton, UBadge, NuxtLink, OrdersOrderStatusBadge as OrderStatusBadge } from '#components'
import { toValue, h } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { tableQueryField, tableQuerySorting } from '~/utils/tableQuery'
import { formatDate, formatDateTime } from '~/utils/datetime'
import type { TableColumn } from '@nuxt/ui'
import type { SortingState, VisibilityState } from '@tanstack/table-core'
import type { SalesOrderListItem } from '~/types/orders'
import { paymentStatusColor, paymentStatusLabel } from '~/utils/orderPayment'

export function useOrderListTable(options: { returnTo: MaybeRefOrGetter<string>, igualacion?: boolean, billing?: MaybeRefOrGetter<boolean> }) {
  const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
  const sorting = ref<SortingState>([])
  useTableQuery([tableQueryField('sort', sorting, tableQuerySorting)])
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

  const { sortableHeader } = useListTableColumns<SalesOrderListItem>()

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

  const invoiceStatusColumn: TableColumn<SalesOrderListItem> = {
    id: 'invoiceCreated',
    accessorFn: row => row.invoiceCreated ? 'Facturado' : 'Sin facturar',
    header: sortableHeader('Estado de facturación'),
    cell: ({ row }) => h(UBadge, {
      color: row.original.invoiceCreated ? 'success' : 'warning',
      label: row.original.invoiceCreated ? 'Facturado' : 'Sin facturar',
      variant: 'subtle'
    })
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

  const numberColumn: TableColumn<SalesOrderListItem> = options.igualacion
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
              query: { returnTo: toValue(options.returnTo) }
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
  }, ...(options.igualacion ? [igualacionColumn] : [paymentStatusColumn]), {
    id: 'status',
    accessorFn: row => row.status.sortOrder,
    header: sortableHeader('Estado'),
    cell: ({ row }) => h(OrderStatusBadge, { status: row.original.status })
  }, ...(toValue(options.billing) ? [invoiceStatusColumn] : []), ...(options.igualacion ? [] : [totalColumn]), {
    accessorKey: 'createdAt',
    header: sortableHeader('Creado'),
    cell: ({ row }) => formatDateTime(row.original.createdAt)
  }, {
    accessorKey: 'updatedAt',
    header: sortableHeader('Última actualización'),
    cell: ({ row }) => formatDateTime(row.original.updatedAt)
  }])
  return { columns, sorting, columnVisibility, selectedOrder, detailOpen, openOrder }
}
