<script setup lang="ts">
import type { OrderDateRange } from '~/types/orders'

defineProps<{ statusItems: Array<{ label: string, value: string }> }>()

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
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Buscar proveedor"
        aria-label="Buscar compras por proveedor"
        class="w-full sm:w-80"
      />
      <USelect
        v-model="status"
        :items="statusItems"
        value-key="value"
        aria-label="Filtrar compras por estado"
        class="w-full sm:hidden"
      />
      <OrdersOrderDateRangePicker v-model="dateRange" subject="compras" />
      <UButton
        v-if="hasActiveFilters"
        label="Quitar filtros"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        class="w-full justify-center sm:w-auto"
        @click="clearFilters"
      />
    </div>
  </div>
</template>
