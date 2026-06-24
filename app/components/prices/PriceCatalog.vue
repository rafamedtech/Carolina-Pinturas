<script setup lang="ts">
import type { CatalogPrice } from '~/types/catalog'

const { error, products, query, status, totalProducts, updatedAt } = usePriceCatalog()
const selectedProduct = shallowRef<CatalogPrice | null>(null)
const detailOpen = shallowRef(false)

const formattedUpdate = computed(() => {
  if (!updatedAt.value) return null

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(updatedAt.value))
})

const errorMessage = computed(() => error.value?.data?.statusMessage || 'No fue posible consultar los precios. Intenta de nuevo más tarde.')

function showProductDetails(product: CatalogPrice) {
  selectedProduct.value = product
  detailOpen.value = true
}
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
      @select-product="showProductDetails"
    />

    <PricesPriceDetailModal v-model:open="detailOpen" :product="selectedProduct" />

    <p v-if="formattedUpdate && !error" class="text-center text-xs text-muted">
      Precios actualizados: {{ formattedUpdate }}
    </p>
  </div>
</template>
