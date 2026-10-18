import { NuxtLink } from '#components'
import { toValue, h } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { tableQueryField, tableQuerySorting } from '~/utils/tableQuery'
import { formatDate } from '~/utils/datetime'
import type { TableColumn } from '@nuxt/ui'
import type { SortingState } from '@tanstack/table-core'
import type { PaymentListItem } from '~/types/payments'
import { paymentMethodLabel } from '~/utils/orderPayment'

export function usePaymentListTable(options: { returnTo: MaybeRefOrGetter<string> }) {
  const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
  const sorting = ref<SortingState>([])
  useTableQuery([tableQueryField('sort', sorting, tableQuerySorting)])

  const { sortableHeader } = useListTableColumns<PaymentListItem>()

  const columns: TableColumn<PaymentListItem>[] = [{
    id: 'order',
    accessorFn: row => row.order.number,
    header: sortableHeader('Pedido'),
    cell: ({ row }) => h(
      NuxtLink,
      {
        to: {
          path: `/ventas/${encodeURIComponent(row.original.order.id)}`,
          query: { returnTo: toValue(options.returnTo) }
        },
        class: 'font-medium text-primary hover:underline'
      },
      () => row.original.order.number
    )
  }, {
    accessorKey: 'paymentDate',
    header: sortableHeader('Fecha'),
    cell: ({ row }) => formatDate(row.original.paymentDate)
  }, {
    id: 'customer',
    accessorFn: row => row.order.customerName,
    header: sortableHeader('Cliente'),
    cell: ({ row }) => row.original.order.customerName
  }, {
    id: 'paymentMethod',
    accessorFn: row => paymentMethodLabel(row.paymentMethod),
    header: sortableHeader('Método'),
    cell: ({ row }) => paymentMethodLabel(row.original.paymentMethod)
  }, {
    accessorKey: 'reference',
    header: sortableHeader('Referencia'),
    cell: ({ row }) => row.original.reference || row.original.siigoVoucherName || '—'
  }, {
    id: 'createdBy',
    accessorFn: row => row.createdBy.name,
    header: sortableHeader('Registró'),
    cell: ({ row }) => row.original.createdBy.name
  }, {
    accessorKey: 'amount',
    header: sortableHeader('Monto', 'right'),
    cell: ({ row }) => h(
      'div',
      { class: 'text-right font-semibold text-highlighted' },
      currency.format(row.original.amount)
    )
  }]
  return { columns, sorting }
}
