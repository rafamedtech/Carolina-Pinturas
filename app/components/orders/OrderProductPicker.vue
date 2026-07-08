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
const productPickerBody = useTemplateRef<HTMLElement>('productPickerBody')

const productMenuReference = {
  getBoundingClientRect() {
    const bodyRect = productPickerBody.value?.getBoundingClientRect()
    const triggerRect = productPickerBody.value
      ?.querySelector<HTMLElement>('[data-product-select-trigger]')
      ?.getBoundingClientRect()

    if (!bodyRect || !triggerRect) return new DOMRect()

    return new DOMRect(bodyRect.left, triggerRect.top, bodyRect.width, triggerRect.height)
  }
}

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
      <h2 class="font-semibold text-primary">
        Agregar producto
      </h2>
    </template>

    <div
      ref="productPickerBody"
      class="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
    >
      <UFormField name="product" label="Producto" class="min-w-0">
        <USelectMenu
          v-model="selectedProductId"
          :items="productOptions"
          value-key="value"
          :filter-fields="['label', 'code', 'reference', 'barcode']"
          :search-input="{ placeholder: 'Buscar por nombre o código' }"
          :content="{ align: 'start', reference: productMenuReference }"
          :loading="loading"
          :disabled="disabled"
          placeholder="Buscar por nombre o código"
          data-product-select-trigger
          class="w-full min-w-0"
        />
      </UFormField>

      <UFormField name="quantity" label="Cantidad" class="min-w-0">
        <UInputNumber
          v-model="quantity"
          :min="0.000001"
          :step="1"
          :disabled="disabled"
          class="w-full min-w-0"
        />
      </UFormField>

      <UButton
        label="Agregar"
        icon="i-lucide-plus"
        class="w-full justify-center sm:w-auto"
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
