<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'
import type { ProductContext, ProductImage, ProductInput } from '~/types/siigo-products'
import { canManageProducts } from '~/utils/roleAccess'

const props = defineProps<{ productId?: string }>()
const { user } = useAuth()
const allowed = computed(() => canManageProducts(user.value?.role))
const title = computed(() => props.productId ? 'Editar producto' : 'Nuevo producto')
const back = computed(() => props.productId ? `/productos/${props.productId}` : '/productos')
const { data: context, error: contextError } = await useFetch<ProductContext>('/api/siigo/products/context', { immediate: allowed.value })
const product = ref<SiigoProduct>()
const loading = shallowRef(Boolean(props.productId))
const loadError = shallowRef('')
const productImage = ref<ProductImage | null>(null)
if (props.productId && allowed.value) {
  try {
    product.value = await $fetch<SiigoProduct>(`/api/siigo/products/${encodeURIComponent(props.productId)}`, { headers: useRequestHeaders(['cookie']), query: { refresh: 'true' } })
    productImage.value = product.value.internal?.image ?? null
    if (!['Product', 'Service', 'ConsumerGood'].includes(product.value.type || 'Product')) loadError.value = 'Este tipo de producto se administra directamente en Siigo.'
  } catch {
    loadError.value = 'No se pudo cargar el producto. Actualiza la página para reintentar.'
  } finally {
    loading.value = false
  }
}
const { saving, errorMessage, ambiguous, checking, lookupResults, save, check } = useProductMutation()
async function submit(input: ProductInput) {
  const saved = await save(input, props.productId)
  if (saved) {
    useToast().add({ title: props.productId ? 'Producto actualizado' : 'Producto creado', color: 'success' })
    await navigateTo(`/productos/${encodeURIComponent(saved.id)}`)
  }
}
useSeoMeta({ title })
</script>

<template>
  <UDashboardPanel id="product-editor">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UButton
            :to="back"
            icon="i-lucide-arrow-left"
            aria-label="Volver a productos"
            color="neutral"
            variant="ghost"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <UAlert v-if="!allowed" title="Solo administradores pueden gestionar productos." color="warning" />
      <UAlert v-else-if="contextError || loadError" :title="loadError || 'No se pudieron cargar las opciones del producto.'" color="error" />
      <template v-else-if="context && !loading">
        <UAlert v-if="errorMessage" :title="errorMessage" color="error" />
        <div v-if="ambiguous" class="space-y-3 rounded-lg border border-warning p-4">
          <UButton label="Consultar resultado en Siigo" :loading="checking" @click="check(productId)" />
          <div v-for="result in lookupResults" :key="result.id" class="space-y-1">
            <p>{{ result.code }} · {{ result.name }} · {{ result.active ? 'Activo' : 'Inactivo' }}</p>
            <UButton :to="`/productos/${result.id}`" label="Abrir producto para revisar" variant="outline" />
          </div>
          <p class="text-sm text-muted">
            Revisa el producto antes de iniciar otro guardado; Siigo pudo procesar la solicitud.
          </p>
        </div>
        <ProductsProductImageField
          v-if="productId && product"
          v-model:image="productImage"
          :product-id="productId"
          :product-name="product.name"
        />
        <ProductsProductForm
          :product="product"
          :context="context"
          :saving="saving"
          :blocked="ambiguous"
          @submit="submit"
          @cancel="navigateTo(back)"
        />
      </template>
      <div v-else role="status">
        Cargando producto…
      </div>
    </template>
  </UDashboardPanel>
</template>
