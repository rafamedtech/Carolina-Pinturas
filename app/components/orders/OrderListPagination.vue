<script setup lang="ts">
const props = defineProps<{
  totalResults: number
  pageSize: number
  loading: boolean
}>()

const page = defineModel<number>('page', { required: true })

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
    class="mt-auto flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <p class="text-sm text-muted">
      Mostrando {{ firstResult }}–{{ lastResult }} de {{ totalResults }} pedidos
    </p>

    <UPagination
      v-model:page="page"
      :total="totalResults"
      :items-per-page="pageSize"
      :disabled="loading"
      show-edges
    />
  </div>
</template>
