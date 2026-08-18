<script setup lang="ts">
import type { SalesOrderListResponse } from '~/types/orders'

const props = defineProps<{
  customerId: string
}>()

const route = useRoute()
const page = shallowRef(1)
const pageSize = 25
const returnTo = computed(() => route.fullPath)

watch(() => props.customerId, () => {
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
    customer_id: computed(() => props.customerId),
    page,
    page_size: pageSize
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

const loading = computed(() => status.value === 'pending')
const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible cargar los pedidos del cliente.'
)
</script>

<template>
  <section class="flex flex-col gap-4" aria-labelledby="customer-orders-title">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="customer-orders-title" class="font-semibold text-highlighted">
          Pedidos del cliente
        </h2>
        <p class="text-sm text-muted">
          {{ orders.pagination.totalResults }}
          {{ orders.pagination.totalResults === 1 ? 'pedido registrado' : 'pedidos registrados' }}
        </p>
      </div>
      <UButton
        label="Actualizar pedidos"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="loading"
        @click="refresh()"
      />
    </div>

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
      :return-to="returnTo"
    />

    <OrdersOrderListPagination
      v-if="!error"
      v-model:page="page"
      :total-results="orders.pagination.totalResults"
      :filtered-total="orders.filteredTotal"
      :page-size="orders.pagination.pageSize"
      :loading="loading"
    />
  </section>
</template>
