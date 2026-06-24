<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Lista de precios | Carolina Pinturas',
  description: 'Consulta los precios vigentes de Carolina Pinturas.'
})
</script>

<template>
  <main class="min-h-screen bg-muted/30 py-8 sm:py-14">
    <UContainer class="max-w-3xl">
      <header class="mb-8 flex items-start gap-4 sm:mb-10">
        <div class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-inverted shadow-lg shadow-primary/20">
          <UIcon name="i-lucide-paint-roller" class="size-6" />
        </div>
        <div>
          <p class="text-sm font-semibold tracking-[0.16em] text-primary uppercase">
            Carolina Pinturas
          </p>
          <h1 class="mt-1 text-3xl font-bold tracking-tight text-highlighted sm:text-4xl">
            Lista de precios
          </h1>
          <p class="mt-2 max-w-xl text-base text-muted">
            Consulta precios de referencia. Para disponibilidad y condiciones comerciales, contáctanos.
          </p>
        </div>
      </header>

      <PricesPriceCatalog />
    </UContainer>
  </main>
</template>
