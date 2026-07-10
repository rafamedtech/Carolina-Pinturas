<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'

defineProps<{
  products: readonly SiigoProduct[]
  loading: boolean
  unitFor: (product: SiigoProduct) => string
  priceFor: (product: SiigoProduct) => string
}>()
</script>

<template>
  <div class="flex flex-col gap-3 md:hidden" :aria-busy="loading">
    <template v-if="loading">
      <UCard
        v-for="index in 3"
        :key="index"
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
      >
        <div class="flex items-center justify-between gap-4">
          <USkeleton class="h-5 w-32" />
          <USkeleton class="h-5 w-16" />
        </div>
        <USkeleton class="h-4 w-full" />
        <div class="grid grid-cols-2 gap-4">
          <USkeleton class="h-10 w-full" />
          <USkeleton class="h-10 w-full" />
        </div>
      </UCard>
      <span class="sr-only" role="status">Cargando productos…</span>
    </template>

    <template v-else-if="products.length">
      <UCard
        v-for="product in products"
        :key="product.id"
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              {{ product.code }}
            </p>
            <NuxtLink
              :to="`/productos/${encodeURIComponent(product.id)}`"
              class="line-clamp-2 text-lg font-semibold text-primary hover:underline"
              :aria-label="`Abrir producto ${product.name}`"
            >
              {{ product.name }}
            </NuxtLink>
          </div>
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt class="text-muted">
              Marca
            </dt>
            <dd class="text-highlighted">
              {{ product.additional_fields?.brand || '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Unidad
            </dt>
            <dd class="text-highlighted">
              {{ unitFor(product) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Existencia
            </dt>
            <dd class="text-highlighted">
              {{ product.available_quantity ?? '—' }}
            </dd>
          </div>
          <div class="col-span-2 flex items-end justify-between gap-4 border-t border-default pt-3">
            <dt class="text-muted">
              Precio
            </dt>
            <dd class="text-base font-semibold text-highlighted">
              {{ priceFor(product) }}
            </dd>
          </div>
        </dl>

        <UButton
          :to="`/productos/${encodeURIComponent(product.id)}`"
          label="Ver producto"
          icon="i-lucide-arrow-right"
          trailing
          block
          variant="soft"
        />
      </UCard>
    </template>

    <div
      v-else
      class="flex flex-col items-center gap-2 rounded-lg border border-default bg-elevated/50 px-4 py-10 text-center"
    >
      <UIcon name="i-lucide-package-open" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        No hay productos para mostrar.
      </p>
    </div>
  </div>
</template>
