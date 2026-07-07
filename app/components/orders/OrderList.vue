<script setup lang="ts">
import type { OrderStatus, SalesOrderListResponse } from '~/types/orders'
import { canCreateOrders } from '~/utils/roleAccess'

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
const { user } = useAuth()
const canCreate = computed(() => Boolean(user.value && canCreateOrders(user.value.role)))
const isHydrated = shallowRef(false)

onMounted(() => {
  isHydrated.value = true
})

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
const loading = computed(() => isHydrated.value && status.value === 'pending')
</script>

<template>
  <UDashboardPanel :id="igualacion ? 'igualaciones' : 'sales-orders'">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="loading"
            @click="refresh()"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <OrdersOrderListToolbar
        v-model:filter="filter"
        v-model:status="statusKey"
        :statuses="statuses"
        :igualacion="igualacion"
        :can-create="canCreate"
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
        :loading="loading"
        :igualacion="igualacion"
      />

      <OrdersOrderListPagination
        v-if="!error"
        v-model:page="page"
        :total-results="orders.pagination.totalResults"
        :page-size="orders.pagination.pageSize"
        :loading="loading"
      />
    </template>
  </UDashboardPanel>
</template>
