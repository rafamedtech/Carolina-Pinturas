import { tableQueryField, tableQuerySorting } from '~/utils/tableQuery'
import { formatDate } from '~/utils/datetime'
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SortingState } from '@tanstack/table-core'
import type { ExpenseRecord } from '~/types/expenses'
import { paymentMethodLabel } from '~/utils/orderPayment'

export function useExpenseListTable() {
  const sorting = ref<SortingState>([])
  useTableQuery([tableQueryField('sort', sorting, tableQuerySorting)])

  function formatCurrency(amount: number, currencyCode: string) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currencyCode
    }).format(amount)
  }

  const { sortableHeader } = useListTableColumns<ExpenseRecord>()

  const columns: TableColumn<ExpenseRecord>[] = [{
    accessorKey: 'date',
    header: sortableHeader('Fecha'),
    cell: ({ row }) => formatDate(row.original.date)
  }, {
    accessorKey: 'category',
    header: sortableHeader('Categoría')
  }, {
    accessorKey: 'description',
    header: sortableHeader('Descripción')
  }, {
    accessorKey: 'provider',
    header: sortableHeader('Proveedor')
  }, {
    id: 'paymentMethod',
    accessorFn: row => paymentMethodLabel(row.paymentMethod),
    header: sortableHeader('Método'),
    cell: ({ row }) => paymentMethodLabel(row.original.paymentMethod)
  }, {
    id: 'createdBy',
    accessorFn: row => row.createdBy.name,
    header: sortableHeader('Registró'),
    cell: ({ row }) => row.original.createdBy.name
  }, {
    accessorKey: 'amount',
    header: sortableHeader('Importe', 'right'),
    cell: ({ row }) => h(
      'div',
      { class: 'text-right font-semibold text-highlighted' },
      formatCurrency(row.original.amount, row.original.currencyCode)
    )
  }]
  return { columns, sorting }
}
