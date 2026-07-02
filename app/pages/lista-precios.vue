<script setup lang="ts">
definePageMeta({ layout: false })

useSeoMeta({
  title: 'Lista de precios',
  description: 'Consulta los precios vigentes de Carolina Pinturas.'
})
</script>

<template>
  <main class="min-h-screen bg-muted/30 py-8 sm:py-14">
    <UContainer class="max-w-3xl">
      <header class="mb-8 flex items-start gap-4 sm:mb-10">
        <UAvatar
          src="/carolina-logo.jpg"
          alt="Carolina Pinturas"
          class="size-12 shrink-0 rounded-2xl ring-1 ring-default shadow-lg"
        />
        <div>
          <p class="text-sm font-semibold tracking-[0.16em] text-primary uppercase">
            Carolina Pinturas
          </p>
          <h1 class="mt-1 text-3xl font-bold tracking-tight text-highlighted sm:text-4xl">
            Lista de precios
          </h1>
        </div>
      </header>

      <PricesPriceCatalog />
    </UContainer>
  </main>
</template>
