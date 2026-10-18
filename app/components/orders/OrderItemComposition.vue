<script setup lang="ts">
import type { SalesOrderItem } from '~/types/orders'

const props = defineProps<{ item: SalesOrderItem }>()
const components = computed(() => {
  const recipe = props.item.inventoryRecipe ?? []
  return recipe.length > 1 || recipe[0]?.productId !== props.item.productId ? recipe : []
})
</script>

<template>
  <details v-if="components.length" class="mt-1 text-xs text-muted">
    <summary class="cursor-pointer">
      Composición del pedido
    </summary>
    <ul class="mt-1 space-y-1">
      <li v-for="component in components" :key="component.productId">
        {{ component.code }} · {{ component.name }}: {{ component.quantity }} {{ component.unit }} por unidad
      </li>
    </ul>
  </details>
</template>
