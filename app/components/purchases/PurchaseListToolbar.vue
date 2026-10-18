<script setup lang="ts">
import type { OrderDateRange } from '~/types/orders'

const search = defineModel<string>('search', { required: true })
const status = defineModel<string>('status', { required: true })
const dateRange = defineModel<OrderDateRange | null>('dateRange', { required: true })

const hasActiveFilters = computed(() => Boolean(search.value || status.value !== 'all' || dateRange.value))

function clearFilters() {
  search.value = ''
  status.value = 'all'
  dateRange.value = null
}
</script>

<template>
  <ListToolbar
    v-model:search="search"
    placeholder="Buscar proveedor"
    :has-active-filters="hasActiveFilters"
    @clear="clearFilters"
  >
    <template #filters>
      <OrdersOrderDateRangePicker v-model="dateRange" subject="compras" />
    </template>
    <template #actions>
      <slot name="actions" />
    </template>
  </ListToolbar>
</template>
