<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'

const props = defineProps<{
  products: SiigoProduct[]
  loading: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  add: [product: SiigoProduct, quantity: number]
}>()

const selectedProductId = shallowRef('')
const quantity = shallowRef(1)

const productOptions = computed(() => props.products.map(product => ({
  label: product.name,
  description: product.code,
  value: product.id
})))
const canAdd = computed(() =>
  Boolean(selectedProductId.value)
  && Number.isFinite(quantity.value)
  && quantity.value > 0
  && !props.disabled
)

function addProduct() {
  const product = props.products.find(item => item.id === selectedProductId.value)
  if (!product || !canAdd.value) return

  emit('add', product, quantity.value)
  selectedProductId.value = ''
  quantity.value = 1
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-highlighted">
        Agregar producto
      </h2>
    </template>

    <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
      <UFormField name="product" label="Producto">
        <USelectMenu
          v-model="selectedProductId"
          :items="productOptions"
          value-key="value"
          :loading="loading"
          :disabled="disabled"
          placeholder="Buscar producto"
          class="w-full"
        />
      </UFormField>

      <UFormField name="quantity" label="Cantidad">
        <UInputNumber
          v-model="quantity"
          :min="0.000001"
          :step="1"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>

      <UButton
        label="Agregar"
        icon="i-lucide-plus"
        :disabled="!canAdd"
        @click="addProduct"
      />
    </div>
  </UCard>
</template>
