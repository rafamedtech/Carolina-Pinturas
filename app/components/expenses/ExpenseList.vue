<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import { PAYMENT_METHODS, paymentMethodLabel } from '~/utils/orderPayment'
import { tableQueryField, tableQueryText, tableQueryPage, tableQueryRange } from '~/utils/tableQuery'
import type { OrderDateRange } from '~/types/orders'
import type { CreateExpenseInput, ExpenseListResponse, ExpenseRecord } from '~/types/expenses'
import type { CsvColumn } from '~/utils/csv'
import { canViewExpenseCategory, visibleExpenseCategories } from '~/utils/expense'

const { user } = useAuth()
const categories = computed(() => user.value
  ? visibleExpenseCategories(user.value.role)
  : [])
const filter = shallowRef('')
const paymentMethod = shallowRef('all')
const category = shallowRef('all')
const dateRange = shallowRef<OrderDateRange | null>(null)
const page = shallowRef(1)
const pageSize = 25
const isHydrated = shallowRef(false)
const modalOpen = shallowRef(false)
const saving = shallowRef(false)
const deleting = shallowRef(false)
const selectedExpense = shallowRef<ExpenseRecord | null>(null)
const submitError = shallowRef('')
const toast = useToast()

onMounted(() => {
  isHydrated.value = true
})

useTableQuery([
  tableQueryField('search', filter, tableQueryText()),
  tableQueryField('payment_method', paymentMethod, tableQueryText('all')),
  tableQueryField('category', category, {
    parse: value => typeof value === 'string' && (!user.value || canViewExpenseCategory(user.value.role, value)) ? value : 'all',
    serialize: value => value === 'all' ? undefined : value
  }),
  tableQueryRange(dateRange),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [filter, paymentMethod, category, dateRange] })

const debouncedFilter = refDebounced(filter, 300)

const dateFrom = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.start.toString()
  : undefined)
const dateTo = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.end.toString()
  : undefined)

const {
  data: expenseCatalog,
  status: expenseStatus,
  error: expenseError,
  refresh: refreshExpenses
} = await useFetch<ExpenseListResponse>('/api/expenses', {
  lazy: true,
  query: {
    page,
    page_size: pageSize,
    search: debouncedFilter,
    payment_method: computed(() => paymentMethod.value === 'all' ? undefined : paymentMethod.value),
    category: computed(() => category.value === 'all' ? undefined : category.value),
    date_from: dateFrom,
    date_to: dateTo
  },
  default: () => ({
    results: [],
    filteredTotal: 0,
    pagination: {
      page: 1,
      pageSize,
      totalResults: 0,
      totalPages: 0
    }
  })
})
const {
  data: supplierCatalog,
  status: supplierStatus,
  error: supplierError
} = useCustomersCatalog({ customerType: 'Supplier' })
const suppliers = computed(() => supplierCatalog.value?.results || [])
const suppliersLoading = computed(() => supplierStatus.value === 'pending')
const suppliersErrorMessage = computed(() => supplierError.value
  ? supplierError.value.data?.statusMessage || 'No fue posible cargar los proveedores.'
  : '')
const expenseErrorMessage = computed(() =>
  expenseError.value?.data?.statusMessage || 'No fue posible cargar los gastos.'
)
const loading = computed(() => isHydrated.value && expenseStatus.value === 'pending')

const csvColumns: CsvColumn<ExpenseRecord>[] = [
  { key: 'date', label: 'Fecha', value: row => formatDate(row.date) },
  { key: 'category', label: 'Categoría' },
  { key: 'description', label: 'Descripción' },
  { key: 'provider', label: 'Proveedor', value: row => row.provider },
  { key: 'providerRfc', label: 'RFC proveedor', value: row => row.providerRfc ?? '' },
  { key: 'paymentMethod', label: 'Método', value: row => paymentMethodLabel(row.paymentMethod) },
  { key: 'createdBy', label: 'Registró', value: row => row.createdBy.name },
  { key: 'amount', label: 'Importe', value: row => row.amount },
  { key: 'currencyCode', label: 'Moneda', value: row => row.currencyCode }
]

function fetchAllExpenses() {
  return fetchAllPages<ExpenseRecord>('/api/expenses', {
    search: debouncedFilter.value || undefined,
    payment_method: paymentMethod.value === 'all' ? undefined : paymentMethod.value,
    category: category.value === 'all' ? undefined : category.value,
    date_from: dateFrom.value,
    date_to: dateTo.value
  })
}

function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currencyCode
  }).format(amount)
}

watch(modalOpen, (isOpen) => {
  if (isOpen) submitError.value = ''
})

function openExpense(expense: ExpenseRecord | null = null) {
  if (expense?.purchasePaymentId) {
    toast.add({ title: 'Gasto vinculado a compras', description: 'Consulta o anula el abono desde Compras.', color: 'info' })
    return
  }
  selectedExpense.value = expense
  submitError.value = ''
  modalOpen.value = true
}

async function deleteExpense() {
  if (!selectedExpense.value || saving.value || deleting.value) return
  deleting.value = true
  submitError.value = ''
  try {
    await $fetch(`/api/expenses/${selectedExpense.value.id}`, { method: 'DELETE' })
    modalOpen.value = false
    toast.add({ title: 'Gasto eliminado', color: 'success', icon: 'i-lucide-circle-check' })
    if (expenseCatalog.value.results.length === 1 && page.value > 1) page.value -= 1
    else await refreshExpenses()
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }, message?: string }
    submitError.value = fetchError.data?.statusMessage || fetchError.message || 'Intenta nuevamente.'
  } finally {
    deleting.value = false
  }
}

async function saveExpense(input: CreateExpenseInput) {
  if (saving.value || deleting.value) return
  saving.value = true
  submitError.value = ''

  try {
    const editing = Boolean(selectedExpense.value)
    const expense = await $fetch<ExpenseRecord>(
      selectedExpense.value ? `/api/expenses/${selectedExpense.value.id}` : '/api/expenses', {
        method: editing ? 'PUT' : 'POST',
        body: input
      })
    modalOpen.value = false
    toast.add({
      title: editing ? 'Gasto actualizado' : 'Gasto agregado',
      description: `${expense.description} por ${formatCurrency(expense.amount, expense.currencyCode)}.`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    if (page.value === 1) await refreshExpenses()
    else page.value = 1
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string }, message?: string }
    submitError.value = fetchError.data?.statusMessage || fetchError.message || 'Intenta nuevamente.'
  } finally {
    saving.value = false
  }
}
const { columns, sorting } = useExpenseListTable()
const filterValues = useListFilterBindings({ paymentMethod, category })
const listConfig = computed<ListLayoutConfig>(() => ({
  id: 'expenses', title: 'Gastos', empty: 'No hay gastos para mostrar.',
  search: { placeholder: 'Buscar descripción, proveedor o categoría' }, dateFilter: { subject: 'gastos' },
  filters: [
    { key: 'category', label: 'Categoría', type: 'select', defaultValue: 'all', items: [{ label: 'Todas las categorías', value: 'all' }, ...categories.value.map(value => ({ label: value, value }))] },
    { key: 'paymentMethod', label: 'Método de pago', type: 'select', defaultValue: 'all', items: [{ label: 'Todos los métodos', value: 'all' }, ...PAYMENT_METHODS.map(item => ({ label: item.label, value: item.key }))] }
  ],
  create: { label: 'Agregar gasto' },
  pagination: { mode: 'server', label: 'gastos', totalLabel: 'Total gastado:', pageSize }
}))
</script>

<template>
  <ListLayout
    v-model:search="filter"
    v-model:date-range="dateRange"
    v-model:filters="filterValues"
    v-model:page="page"
    v-model:sorting="sorting"
    :config="listConfig"
    :data="expenseCatalog.results"
    :columns="columns"
    :loading="loading"
    :error="Boolean(expenseError)"
    error-title="Gastos no disponibles"
    :error-message="expenseErrorMessage"
    :total-results="expenseCatalog.pagination.totalResults"
    :filtered-total="expenseCatalog.filteredTotal"
    @refresh="refreshExpenses()"
    @create="openExpense()"
    @select="(_event, row) => openExpense(row.original)"
  >
    <template #actions>
      <AppCsvExportButton
        filename="gastos"
        :columns="csvColumns"
        :fetch-all="fetchAllExpenses"
        :disabled="loading"
      />
    </template>
    <template #mobile>
      <ExpensesExpenseListCards :expenses="expenseCatalog.results" @select="openExpense" />
    </template>
    <template #overlays>
      <ExpensesExpenseAddModal
        v-model:open="modalOpen"
        :categories="categories"
        :suppliers="suppliers"
        :suppliers-loading="suppliersLoading"
        :suppliers-error="suppliersErrorMessage"
        :saving="saving"
        :deleting="deleting"
        :expense="selectedExpense"
        :submit-error="submitError"
        @submit="saveExpense"
        @delete="deleteExpense"
      />
    </template>
  </ListLayout>
</template>
