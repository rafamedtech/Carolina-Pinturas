<script setup lang="ts">
const { error, products, query, status, totalProducts, updatedAt } = usePriceCatalog()

const formattedUpdate = computed(() => {
  if (!updatedAt.value) return null

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(updatedAt.value))
})

const errorMessage = computed(() => error.value?.data?.statusMessage || 'No fue posible consultar los precios. Intenta de nuevo más tarde.')
</script>

<template>
  <div class="space-y-5">
    <PricesPriceSearch
      v-model="query"
      :total-products="totalProducts"
      :results-count="products.length"
    />

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Catálogo no disponible"
      :description="errorMessage"
    />

    <PricesPriceList
      v-else
      :products="products"
      :loading="status === 'pending'"
      :query="query"
    />

    <p v-if="formattedUpdate && !error" class="text-center text-xs text-muted">
      Precios actualizados: {{ formattedUpdate }}
    </p>
  </div>
</template>
