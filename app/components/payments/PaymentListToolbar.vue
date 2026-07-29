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
</script>

<template>
  <div class="flex w-full flex-col gap-2 sm:flex-row">
    <UInput
      v-model="filter"
      icon="i-lucide-search"
      placeholder="Buscar pedido, cliente o referencia"
      class="w-full sm:w-96"
    />
    <USelect
      v-model="paymentMethod"
      :items="paymentMethodOptions"
      value-key="value"
      class="w-full sm:w-48"
    />
    <OrdersOrderDateRangePicker v-model="dateRange" />
  </div>
</template>
