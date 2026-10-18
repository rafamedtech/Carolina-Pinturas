<script setup lang="ts">
import type { OrderDateRange } from '~/types/orders'
import type { ExpenseCategory } from '~/utils/expense'
import { PAYMENT_METHODS } from '~/utils/orderPayment'

const props = defineProps<{
  categories: readonly ExpenseCategory[]
}>()

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
const categoryOptions = computed(() => [{
  label: 'Todas las categorías',
  value: 'all'
}, ...props.categories.map(item => ({
  label: item,
  value: item as string
}))])

const hasActiveFilters = computed(() => Boolean(filter.value || paymentMethod.value !== 'all' || dateRange.value || category.value !== 'all'))
function clearFilters() {
  filter.value = ''
  paymentMethod.value = 'all'
  dateRange.value = null
  category.value = 'all'
}
const emit = defineEmits<{ create: [] }>()
</script>

<template>
  <ListToolbar
    v-model:search="filter"
    placeholder="Buscar descripción, proveedor o categoría"
    :has-active-filters="hasActiveFilters"
    @clear="clearFilters"
  >
    <template #filters>
      <USelect
        v-model="category"
        :items="categoryOptions"
        aria-label="Filtrar por categoría"
        class="w-full sm:w-56"
      />
      <USelect
        v-model="paymentMethod"
        :items="paymentMethodOptions"
        aria-label="Filtrar por método de pago"
        class="w-full sm:w-48"
      />
      <OrdersOrderDateRangePicker v-model="dateRange" subject="gastos" />
    </template>
    <template #actions>
      <UButton
        label="Agregar gasto"
        icon="i-lucide-plus"
        class="w-full justify-center sm:w-auto"
        @click="emit('create')"
      />
    </template>
  </ListToolbar>
</template>
