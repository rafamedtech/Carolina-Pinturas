<script setup lang="ts">
import type { ProductAvailability } from '#shared/schemas/product'

const model = defineModel<ProductAvailability>({ required: true })
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        Disponibilidad del producto
      </h2>
    </template>
    <div class="space-y-4">
      <p class="text-sm text-muted">
        Selecciona dónde puede elegirse este producto. Puedes activar varias opciones.
      </p>
      <div class="flex flex-wrap gap-6">
        <USwitch v-model="model.purchase" label="Compra" />
        <USwitch v-model="model.sale" label="Venta directa" />
        <USwitch v-model="model.expense" label="Gasto" />
      </div>
    </div>
  </UCard>
</template>
