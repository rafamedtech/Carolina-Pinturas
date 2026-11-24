<script setup lang="ts">
import type { InventoryValuation } from '#shared/types/inventory'

defineProps<{ valuation: InventoryValuation }>()
</script>

<template>
  <section aria-labelledby="inventory-valuation-title" class="min-w-0 space-y-4">
    <DetailSectionHeading
      title="Valor de la mercancía"
      title-id="inventory-valuation-title"
      description="Existencias físicas, incluidas las reservas, al último costo registrado. Cada moneda se presenta por separado."
    />

    <InventoryValuationDetails :valuation="valuation" />
  </section>
</template>
