<script setup lang="ts">
import type { SalesOrderItem } from '~/types/orders'

const props = defineProps<{ item: SalesOrderItem }>()
const components = computed(() => {
  const recipe = props.item.inventoryRecipe ?? []
  return recipe.length > 1 || recipe[0]?.productId !== props.item.productId ? recipe : []
})
</script>

<template>
  <UTooltip
    v-if="components.length"
    :delay-duration="0"
    :content="{ side: 'top' }"
    :ui="{ content: 'h-auto max-w-xs whitespace-normal p-3' }"
  >
    <UButton
      icon="i-lucide-layers"
      color="neutral"
      variant="ghost"
      size="xs"
      class="shrink-0"
      :aria-label="`Ver componentes de ${item.name}`"
    />
    <template #content>
      <div class="space-y-2 text-xs">
        <p class="font-semibold text-primary">
          Composición del producto
        </p>
        <ul class="space-y-1">
          <li v-for="component in components" :key="component.productId">
            {{ component.quantity }} - {{ component.name }}
          </li>
        </ul>
      </div>
    </template>
  </UTooltip>
</template>
