<script setup lang="ts">
import type { ProductAvailability } from '#shared/schemas/product'

const model = defineModel<ProductAvailability>({ required: true })
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        Disponibilidad interna
      </h2>
    </template>
    <div class="space-y-4">
      <p class="text-sm text-muted">
        Selecciona dónde puede elegirse este producto. Puedes activar varias opciones o ninguna.
      </p>
      <div class="flex flex-wrap gap-6">
        <USwitch v-model="model.purchase" label="Compra" />
        <USwitch v-model="model.sale" label="Venta directa" />
        <USwitch v-model="model.expense" label="Gasto" />
      </div>
      <p class="text-sm text-muted">
        Desactiva Venta directa para componentes que solo se venden dentro de un producto compuesto. Seguirán disponibles al definir su composición. Los compuestos no se pueden comprar ni recibir como existencias propias.
      </p>
    </div>
  </UCard>
</template>
