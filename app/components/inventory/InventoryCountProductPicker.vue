<script setup lang="ts">
import type { InventoryProduct } from '#shared/types/inventory'
import { fetchAllPages } from '~/composables/useCsvExport'

const props = defineProps<{ excludedIds: string[], busy: boolean }>()
const emit = defineEmits<{ add: [productId: string] }>()
const selected = shallowRef('')
const requestFetch = useRequestFetch()
const { data, status, error, refresh } = await useAsyncData('inventory-count-products', () =>
  fetchAllPages<InventoryProduct>('/api/inventory/products', { controlledOnly: 'true' }, 100, requestFetch)
)
const products = computed(() => (data.value ?? []).filter(p => !props.excludedIds.includes(p.id)))
function add() {
  if (!selected.value || props.busy || props.excludedIds.includes(selected.value)) return
  emit('add', selected.value)
}
watch(() => props.excludedIds, (ids) => {
  if (ids.includes(selected.value)) selected.value = ''
})
</script>

<template>
  <div class="space-y-3 rounded-lg border border-default bg-elevated/30 p-4">
    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <UFormField label="Producto para contar" class="min-w-0">
        <ProductsProductSearch
          v-model="selected"
          :products="products"
          aria-label="Producto para contar"
          :loading="status === 'pending'"
          :disabled="busy || Boolean(error)"
        />
      </UFormField>
      <UButton
        label="Agregar producto"
        icon="i-lucide-plus"
        :disabled="!selected || busy || Boolean(error) || excludedIds.includes(selected)"
        :loading="busy"
        @click="add"
      />
    </div>
    <p v-if="error" role="alert" class="text-sm text-error">
      No se pudieron cargar los productos.
      <UButton
        label="Reintentar"
        variant="link"
        :disabled="busy"
        @click="refresh()"
      />
    </p>
  </div>
</template>
