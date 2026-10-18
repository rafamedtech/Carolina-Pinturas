<script setup lang="ts">
const props = withDefaults(defineProps<{
  totalResults: number
  pageSize: number
  loading?: boolean
  label: string
  filteredTotal?: number
  totalLabel?: string
}>(), { totalLabel: 'Total:' })

const page = defineModel<number>('page', { required: true })
const firstResult = computed(() => props.totalResults ? ((page.value - 1) * props.pageSize) + 1 : 0)
const lastResult = computed(() => Math.min(page.value * props.pageSize, props.totalResults))
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
</script>

<template>
  <div
    v-if="totalResults > 0"
    class="mt-auto grid gap-3 border-t border-default pt-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
  >
    <p class="text-sm text-muted" aria-live="polite">
      Mostrando {{ firstResult }}–{{ lastResult }} de {{ totalResults }} {{ label }}
    </p>
    <p v-if="filteredTotal !== undefined" class="text-center text-sm">
      <span class="text-muted">{{ totalLabel }}</span>
      <span class="font-semibold text-highlighted"> {{ currency.format(filteredTotal) }}</span>
    </p>
    <UPagination
      v-model:page="page"
      :total="totalResults"
      :items-per-page="pageSize"
      :disabled="loading"
      :sibling-count="0"
      class="min-w-0 max-w-full justify-self-center sm:hidden"
    />
    <UPagination
      v-model:page="page"
      :total="totalResults"
      :items-per-page="pageSize"
      :disabled="loading"
      class="hidden sm:col-start-3 sm:row-start-1 sm:block sm:justify-self-end"
      show-edges
    />
  </div>
</template>
