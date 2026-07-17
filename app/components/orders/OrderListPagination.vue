<script setup lang="ts">
const props = defineProps<{
  totalResults: number
  filteredTotal?: number
  pageSize: number
  loading: boolean
}>()

const page = defineModel<number>('page', { required: true })
const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
})

const firstResult = computed(() =>
  props.totalResults ? ((page.value - 1) * props.pageSize) + 1 : 0
)
const lastResult = computed(() =>
  Math.min(page.value * props.pageSize, props.totalResults)
)
</script>

<template>
  <div
    v-if="totalResults > 0"
    class="mt-auto grid gap-3 border-t border-default pt-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
  >
    <p class="text-sm text-muted">
      Mostrando {{ firstResult }}–{{ lastResult }} de {{ totalResults }} pedidos
    </p>

    <p v-if="filteredTotal !== undefined" class="text-sm text-center">
      <span class="text-muted">Total:</span>
      <span class="font-semibold text-highlighted">{{ currency.format(filteredTotal) }}</span>
    </p>

    <UPagination
      v-model:page="page"
      :total="totalResults"
      :items-per-page="pageSize"
      :disabled="loading"
      class="sm:justify-self-end"
      show-edges
    />
  </div>
</template>
