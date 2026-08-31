<script setup lang="ts">
import type { OrderDateRange } from '~/types/orders'
import { EXPENSE_CATEGORIES } from '~/utils/expense'
import { PAYMENT_METHODS } from '~/utils/orderPayment'

const filter = defineModel<string>('filter', { required: true })
const paymentMethod = defineModel<string>('paymentMethod', { required: true })
const category = defineModel<string>('category', { required: true })
const dateRange = defineModel<OrderDateRange | null>('dateRange', { required: true })

const paymentMethodOptions = [{
  label: 'Todos los métodos',
  value: 'all'
}, ...PAYMENT_METHODS.map(item => ({
  label: item.label,
  value: item.key as string
}))]
const categoryOptions = [{
  label: 'Todas las categorías',
  value: 'all'
}, ...EXPENSE_CATEGORIES.map(item => ({
  label: item,
  value: item as string
}))]
</script>

<template>
  <div class="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
    <UInput
      v-model="filter"
      icon="i-lucide-search"
      placeholder="Buscar descripción, proveedor o categoría"
      class="w-full sm:w-96"
    />
    <USelect
      v-model="category"
      :items="categoryOptions"
      value-key="value"
      class="w-full sm:w-56"
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
