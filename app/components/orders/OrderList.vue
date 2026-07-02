<script setup lang="ts">
import type { OrderStatus, SalesOrderListResponse } from '~/types/orders'

const props = withDefaults(defineProps<{
  title?: string
  igualacion?: boolean
}>(), {
  title: 'Pedidos',
  igualacion: false
})

const filter = shallowRef('')
const statusKey = shallowRef('all')
const page = shallowRef(1)
const pageSize = 25
const debouncedFilter = refDebounced(filter, 300)

watch([filter, statusKey], () => {
  page.value = 1
})

const {
  data: orders,
  status,
  error,
  refresh
} = await useFetch<SalesOrderListResponse>('/api/orders', {
  lazy: true,
  query: {
    page,
    page_size: pageSize,
    search: debouncedFilter,
    status: computed(() => statusKey.value === 'all' ? undefined : statusKey.value),
    igualacion: props.igualacion ? 'true' : undefined
  },
  default: () => ({
    results: [],
    pagination: {
      page: 1,
      pageSize,
      totalResults: 0,
      totalPages: 0
    }
  })
})
const { data: statuses } = await useFetch<OrderStatus[]>('/api/orders/statuses', {
  key: 'order-statuses',
  default: () => []
})

const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible cargar los pedidos.'
)
</script>

<template>
  <UDashboardPanel :id="igualacion ? 'igualaciones' : 'sales-orders'">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <OrdersOrderListToolbar
        v-model:filter="filter"
        v-model:status="statusKey"
        :statuses="statuses"
        :loading="status === 'pending'"
        :igualacion="igualacion"
        @refresh="refresh"
      />

      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Pedidos no disponibles"
        :description="errorMessage"
        icon="i-lucide-database-zap"
      />

      <OrdersOrderListTable
        v-else
        :orders="orders.results"
        :loading="status === 'pending'"
        :igualacion="igualacion"
      />

      <OrdersOrderListPagination
        v-if="!error"
        v-model:page="page"
        :total-results="orders.pagination.totalResults"
        :page-size="orders.pagination.pageSize"
        :loading="status === 'pending'"
      />
    </template>
  </UDashboardPanel>
</template>
