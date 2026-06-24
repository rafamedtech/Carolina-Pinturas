<script setup lang="ts">
const model = defineModel<string>({ default: '' })

defineProps<{
  totalProducts: number
  resultsCount: number
}>()
</script>

<template>
  <section aria-labelledby="catalog-search-title" class="space-y-3">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id="catalog-search-title" class="text-base font-semibold text-highlighted">
          Encuentra tu producto
        </h2>
        <p class="mt-1 text-sm text-muted">
          Busca por nombre o código entre {{ totalProducts.toLocaleString('es-MX') }} productos.
        </p>
      </div>
      <p v-if="model" class="text-sm text-muted" aria-live="polite">
        {{ resultsCount }} resultado{{ resultsCount === 1 ? '' : 's' }}
      </p>
    </div>

    <UInput
      v-model="model"
      icon="i-lucide-search"
      size="xl"
      placeholder="Ej. esmalte blanco o código 1001"
      autocomplete="off"
      class="w-full"
      :ui="{ base: 'rounded-xl' }"
    >
      <template v-if="model" #trailing>
        <UButton
          aria-label="Limpiar búsqueda"
          color="neutral"
          variant="link"
          icon="i-lucide-x"
          :padded="false"
          @click="model = ''"
        />
      </template>
    </UInput>
  </section>
</template>
