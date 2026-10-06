<script setup lang="ts">
import type { SelectMenuProps } from '@nuxt/ui'
import type { SearchableProduct } from '~/types/product-search'

const props = defineProps<{
  products: SearchableProduct[]
  loading: boolean
  disabled: boolean
  content?: SelectMenuProps['content']
}>()
const selectedProductId = defineModel<string>({ required: true })
const options = computed(() => props.products.map(product => ({
  label: product.name,
  description: product.code ? `Código: ${product.code}` : 'Sin código',
  code: product.code,
  reference: product.reference,
  barcode: product.additional_fields?.barcode,
  value: product.id
})))
</script>

<template>
  <USelectMenu
    v-model="selectedProductId"
    :items="options"
    value-key="value"
    :filter-fields="['label', 'code', 'reference', 'barcode']"
    :search-input="{ placeholder: 'Escribe el nombre o código del producto' }"
    :content="content"
    :loading="loading"
    :disabled="disabled"
    icon="i-lucide-search"
    placeholder="Buscar por nombre o código"
    class="w-full min-w-0"
  />
</template>
