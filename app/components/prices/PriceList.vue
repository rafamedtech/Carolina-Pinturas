<script setup lang="ts">
import type { CatalogPrice } from '~/types/catalog'

const props = defineProps<{
  products: CatalogPrice[]
  loading: boolean
  query: string
}>()

const emit = defineEmits<{
  selectProduct: [product: CatalogPrice]
}>()

function formatPrice(product: CatalogPrice) {
  if (product.price === null) return 'Consultar'

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: product.currency
  }).format(product.price)
}

const emptyMessage = computed(() => props.query
  ? 'No encontramos productos con esa búsqueda.'
  : 'No hay precios disponibles por el momento.'
)
</script>

<template>
  <section aria-live="polite" class="overflow-hidden rounded-2xl border border-default bg-default shadow-sm">
    <div v-if="loading" class="space-y-3 p-5 sm:p-6">
      <USkeleton v-for="index in 6" :key="index" class="h-16 w-full rounded-xl" />
    </div>

    <div v-else-if="products.length" class="divide-y divide-default">
      <button
        v-for="product in products"
        :key="`${product.code}-${product.name}`"
        type="button"
        class="flex w-full flex-col items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:flex-row sm:items-start sm:justify-between sm:gap-5 sm:px-6"
        @click="emit('selectProduct', product)"
      >
        <div class="w-full sm:min-w-0 sm:flex-1">
          <p class="text-base font-medium text-highlighted">
            {{ product.name }}
          </p>
          <p class="mt-1 font-mono text-xs tracking-wide text-muted">
            {{ product.code || 'Sin código' }}
          </p>
        </div>
        <p class="shrink-0 text-base font-bold tabular-nums text-primary sm:text-right sm:text-lg">
          {{ formatPrice(product) }}
        </p>
      </button>
    </div>

    <div v-else class="px-6 py-16 text-center">
      <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-elevated text-muted">
        <UIcon name="i-lucide-search-x" class="size-5" />
      </div>
      <p class="mt-4 font-medium text-highlighted">
        {{ emptyMessage }}
      </p>
      <p v-if="query" class="mt-1 text-sm text-muted">
        Intenta con otro nombre o código.
      </p>
    </div>
  </section>
</template>
