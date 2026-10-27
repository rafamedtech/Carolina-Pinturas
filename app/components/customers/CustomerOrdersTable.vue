<script setup lang="ts">
import type { ListLayoutConfig } from '~/types/list'
import { tableQueryField, tableQueryPage } from '~/utils/tableQuery'
import type { SalesOrderListResponse } from '~/types/orders'

const props = defineProps<{
  customerId: string
}>()

const page = shallowRef(1)
const pageSize = 25
const { returnTo } = useTableQuery([tableQueryField('orders_page', page, tableQueryPage)])

watch(() => props.customerId, () => {
  page.value = 1
})

const {
  data: orders,
  status,
  error,
  refresh
} = useFetch<SalesOrderListResponse>('/api/orders', {
  server: false,
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

const loading = computed(() => ['idle', 'pending'].includes(status.value))
const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible cargar los pedidos del cliente.'
)
const { columns, sorting, columnVisibility, selectedOrder, detailOpen, openOrder } = useOrderListTable({ returnTo })
const listConfig: ListLayoutConfig = {
  id: 'customer-orders', title: 'Pedidos del cliente', empty: 'No hay pedidos para mostrar.',
  pagination: { mode: 'server', label: 'pedidos', pageSize }
}
</script>

<template>
  <ListLayout
    v-model:page="page"
    v-model:sorting="sorting"
    v-model:column-visibility="columnVisibility"
    :config="listConfig"
    :data="orders.results"
    :columns="columns"
    :loading="loading"
    :error="Boolean(error)"
    :error-message="errorMessage"
    :total-results="orders.pagination.totalResults"
    :filtered-total="orders.filteredTotal"
    embedded
    @refresh="refresh()"
  >
    <template #before>
      <p class="text-sm text-muted">
        {{ orders.pagination.totalResults }} {{ orders.pagination.totalResults === 1 ? 'pedido registrado' : 'pedidos registrados' }}
      </p>
    </template>
    <template #mobile>
      <OrdersOrderListCards
        :orders="orders.results"
        :loading="false"
        :return-to="returnTo"
        @open="openOrder"
      />
    </template>
    <template #overlays>
      <OrdersOrderListPreviewModal v-model:open="detailOpen" :order="selectedOrder" :return-to="returnTo" />
    </template>
  </ListLayout>
</template>
