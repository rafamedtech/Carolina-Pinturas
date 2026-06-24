<script setup lang="ts">
interface CatalogPrice {
  code: string
  name: string
  price: number | null
  currency: string
}

const props = defineProps<{
  products: CatalogPrice[]
  loading: boolean
  query: string
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
      <article
        v-for="product in products"
        :key="`${product.code}-${product.name}`"
        class="flex items-center justify-between gap-5 px-5 py-4 transition-colors hover:bg-elevated/50 sm:px-6"
      >
        <div class="min-w-0">
          <p class="truncate text-base font-medium text-highlighted">
            {{ product.name }}
          </p>
          <p class="mt-1 font-mono text-xs tracking-wide text-muted">
            {{ product.code || 'Sin código' }}
          </p>
        </div>
        <p class="shrink-0 text-right text-base font-bold tabular-nums text-primary sm:text-lg">
          {{ formatPrice(product) }}
        </p>
      </article>
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
