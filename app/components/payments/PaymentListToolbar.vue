<script setup lang="ts">
import type { OrderDateRange } from '~/types/orders'
import { PAYMENT_METHODS } from '~/utils/orderPayment'

const filter = defineModel<string>('filter', { required: true })
const paymentMethod = defineModel<string>('paymentMethod', { required: true })
const dateRange = defineModel<OrderDateRange | null>('dateRange', { required: true })

const paymentMethodOptions = [{
  label: 'Todos los métodos',
  value: 'all'
}, ...PAYMENT_METHODS.map(item => ({
  label: item.label,
  value: item.key as string
}))]

const hasActiveFilters = computed(() => Boolean(filter.value || paymentMethod.value !== 'all' || dateRange.value))
function clearFilters() {
  filter.value = ''
  paymentMethod.value = 'all'
  dateRange.value = null
}
</script>

<template>
  <ListToolbar
    v-model:search="filter"
    placeholder="Buscar pedido, cliente o referencia"
    :has-active-filters="hasActiveFilters"
    @clear="clearFilters"
  >
    <template #filters>
      <USelect
        v-model="paymentMethod"
        :items="paymentMethodOptions"
        aria-label="Filtrar por método de pago"
        class="w-full sm:w-48"
      />
      <OrdersOrderDateRangePicker v-model="dateRange" subject="pagos" />
    </template>
  </ListToolbar>
</template>
