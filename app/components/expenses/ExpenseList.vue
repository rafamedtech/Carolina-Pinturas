<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { OrderDateRange } from '~/types/orders'
import type { CreateExpenseInput, ExpenseListResponse, ExpenseRecord } from '~/types/expenses'

function queryValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function queryPage(value: unknown) {
  const parsedPage = Number(queryValue(value))
  return Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
}

function queryDateRange(from: unknown, to: unknown): OrderDateRange | null {
  const start = queryValue(from)
  const end = queryValue(to)
  if (!start || !end) return null

  try {
    return { start: parseDate(start), end: parseDate(end) }
  } catch {
    return null
  }
}

const route = useRoute()
const router = useRouter()
const filter = shallowRef(queryValue(route.query.search))
const paymentMethod = shallowRef(queryValue(route.query.payment_method) || 'all')
const category = shallowRef(queryValue(route.query.category) || 'all')
const dateRange = shallowRef<OrderDateRange | null>(
  queryDateRange(route.query.date_from, route.query.date_to)
)
const page = shallowRef(queryPage(route.query.page))
const pageSize = 25
const debouncedFilter = refDebounced(filter, 300)
const isHydrated = shallowRef(false)
const modalOpen = shallowRef(false)
const saving = shallowRef(false)
const submitError = shallowRef('')
const toast = useToast()

onMounted(() => {
  isHydrated.value = true
})

watch([filter, paymentMethod, category, dateRange], () => {
  page.value = 1
})

const dateFrom = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.start.toString()
  : undefined)
const dateTo = computed(() => dateRange.value?.start && dateRange.value?.end
  ? dateRange.value.end.toString()
  : undefined)
const listQuery = computed(() => ({
  ...(filter.value ? { search: filter.value } : {}),
  ...(paymentMethod.value !== 'all' ? { payment_method: paymentMethod.value } : {}),
  ...(category.value !== 'all' ? { category: category.value } : {}),
  ...(dateFrom.value ? { date_from: dateFrom.value } : {}),
  ...(dateTo.value ? { date_to: dateTo.value } : {}),
  ...(page.value > 1 ? { page: String(page.value) } : {})
}))

watch([debouncedFilter, paymentMethod, category, dateFrom, dateTo, page], () => {
  void router.replace({ query: listQuery.value })
})

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

function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currencyCode
  }).format(amount)
}

watch(modalOpen, (isOpen) => {
  if (isOpen) submitError.value = ''
})

async function addExpense(input: CreateExpenseInput) {
  saving.value = true
  submitError.value = ''

  try {
    const expense = await $fetch<ExpenseRecord>('/api/expenses', {
      method: 'POST',
      body: input
    })
    modalOpen.value = false
    toast.add({
      title: 'Gasto agregado',
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
</script>

<template>
  <UDashboardPanel id="expenses">
    <template #header>
      <UDashboardNavbar title="Gastos">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            aria-label="Actualizar"
            :ui="{ label: 'hidden sm:inline' }"
            :loading="loading"
            @click="refreshExpenses()"
          />
          <UButton
            label="Agregar gasto"
            icon="i-lucide-plus"
            :ui="{ label: 'hidden sm:inline' }"
            @click="modalOpen = true"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <ExpensesExpenseListToolbar
        v-model:filter="filter"
        v-model:payment-method="paymentMethod"
        v-model:category="category"
        v-model:date-range="dateRange"
      />

      <UAlert
        v-if="expenseError"
        color="warning"
        variant="subtle"
        title="Gastos no disponibles"
        :description="expenseErrorMessage"
        icon="i-lucide-database-zap"
      />

      <ExpensesExpenseListTable
        v-else
        :expenses="expenseCatalog.results"
        :loading="loading"
      />

      <ExpensesExpenseListPagination
        v-if="!expenseError"
        v-model:page="page"
        :total-results="expenseCatalog.pagination.totalResults"
        :filtered-total="expenseCatalog.filteredTotal"
        :page-size="expenseCatalog.pagination.pageSize"
        :loading="loading"
      />

      <ExpensesExpenseAddModal
        v-model:open="modalOpen"
        :suppliers="suppliers"
        :suppliers-loading="suppliersLoading"
        :suppliers-error="suppliersErrorMessage"
        :saving="saving"
        :submit-error="submitError"
        @submit="addExpense"
      />
    </template>
  </UDashboardPanel>
</template>
