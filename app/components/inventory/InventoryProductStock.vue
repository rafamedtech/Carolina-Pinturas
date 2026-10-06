<script setup lang="ts">
import type { InventoryStock, InventoryPage } from '#shared/types/inventory'

const props = defineProps<{ productId: string }>()
const { data, error } = await useFetch<InventoryPage<InventoryStock>>('/api/inventory/stocks', { query: computed(() => ({ productId: props.productId, page_size: 100 })) })
function showKardex(row: InventoryStock) {
  return navigateTo({ path: '/inventario', query: { productId: row.productId, warehouseId: row.warehouseId } })
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-primary">
        Inventario interno por almacén
      </h2>
    </template><UAlert v-if="error" title="No se pudo cargar el inventario interno." color="error" /><InventoryStockTable v-else :rows="data?.results ?? []" @kardex="showKardex" />
  </UCard>
</template>
