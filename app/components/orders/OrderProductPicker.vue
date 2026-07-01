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
  description: product.code ? `Código: ${product.code}` : 'Sin código',
  code: product.code,
  reference: product.reference,
  barcode: product.additional_fields?.barcode,
  value: product.id
})))
const selectedProduct = computed(() =>
  props.products.find(product => product.id === selectedProductId.value) ?? null
)
const canAdd = computed(() =>
  Boolean(selectedProduct.value)
  && Number.isFinite(quantity.value)
  && quantity.value > 0
  && !props.disabled
)

function addProduct() {
  if (!selectedProduct.value || !canAdd.value) return

  emit('add', selectedProduct.value, quantity.value)
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
          :filter-fields="['label', 'code', 'reference', 'barcode']"
          :search-input="{ placeholder: 'Buscar por nombre o código' }"
          :loading="loading"
          :disabled="disabled"
          placeholder="Buscar por nombre o código"
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

    <OrdersOrderProductDetails
      v-if="selectedProduct"
      :key="selectedProduct.id"
      :product="selectedProduct"
      class="mt-5"
    />
  </UCard>
</template>
