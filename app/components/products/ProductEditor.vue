<script setup lang="ts">
import { tableReturnPath } from '~/utils/tableQuery'
import type { SiigoProduct } from '~/types/siigo'
import type { ProductContext, ProductImage, ProductInput } from '~/types/siigo-products'
import { canManageProducts } from '~/utils/roleAccess'

const props = defineProps<{ productId?: string, duplicateFrom?: string }>()
const { user } = useAuth()
const allowed = computed(() => canManageProducts(user.value?.role))
const title = computed(() => props.productId ? 'Editar producto' : props.duplicateFrom ? 'Duplicar producto' : 'Nuevo producto')
const route = useRoute()
const returnTo = computed(() => tableReturnPath(route.query.returnTo, '/productos'))
const sourceId = computed(() => props.productId || props.duplicateFrom)
const back = computed(() => sourceId.value
  ? { path: `/productos/${sourceId.value}`, query: { returnTo: returnTo.value } }
  : returnTo.value)
const { data: context, error: contextError } = useFetch<ProductContext>('/api/siigo/products/context', { lazy: true, server: false, immediate: allowed.value })
const { data: product, status: productStatus, error: productError } = useFetch<SiigoProduct>(
  () => `/api/siigo/products/${encodeURIComponent(sourceId.value || '')}`,
  { lazy: true, server: false, immediate: Boolean(sourceId.value && allowed.value) }
)
const loading = computed(() => Boolean(sourceId.value) && (productStatus.value === 'idle' || productStatus.value === 'pending'))
const loadError = computed(() => {
  if (productError.value) return 'No se pudo cargar el producto. Actualiza la página para reintentar.'
  if (product.value && (product.value.type || 'Product') !== 'Product') return 'Este tipo de producto se conserva solo para consulta histórica.'
  return ''
})
const productImage = ref<ProductImage | null>(null)
watch(product, (value) => {
  productImage.value = value?.internal?.image ?? null
}, { immediate: true })
const { saving, errorMessage, ambiguous, checking, lookupResults, save, check, discard } = useProductMutation()
const discardedWriteId = shallowRef('')
const discardOpen = shallowRef(false)
const pendingWriteId = computed(() => product.value?.internal?.pendingWriteId)
const hasPendingWrite = computed(() => Boolean(props.productId && product.value?.internal?.syncPending && pendingWriteId.value !== discardedWriteId.value))
async function unlock() {
  if (!props.productId || !pendingWriteId.value) return
  if (await discard(props.productId, pendingWriteId.value)) {
    discardedWriteId.value = pendingWriteId.value
    discardOpen.value = false
    useToast().add({ title: 'Producto desbloqueado. Ya puedes guardar tus cambios.', color: 'success' })
  }
}
async function recover() {
  const saved = await check(props.productId, product.value?.internal?.pendingWriteId)
  if (saved) await navigateTo(`/productos/${saved.id}`)
}
async function submit(input: ProductInput) {
  const saved = await save(input, props.productId)
  if (saved) {
    useToast().add({ title: props.productId ? 'Producto actualizado' : 'Producto creado', color: 'success' })
    await navigateTo({ path: `/productos/${encodeURIComponent(saved.id)}`, query: { returnTo: returnTo.value } })
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
        <UAlert v-if="hasPendingWrite" title="Este producto tiene un guardado pendiente de conciliar." color="warning">
          <template #actions>
            <UButton
              label="Consultar y conciliar guardado"
              :loading="checking"
              :disabled="checking"
              @click="recover"
            />
            <UModal v-model:open="discardOpen" title="Desbloquear edición" description="Conservar los datos actuales y cerrar el intento anterior.">
              <UButton
                label="Desbloquear edición"
                color="neutral"
                variant="outline"
                :disabled="checking"
              />
              <template #body>
                <div class="space-y-4">
                  <p>Se consultará el producto actual en Siigo y se cerrará el intento pendiente. Los cambios internos de ese intento no se aplicarán. Las correcciones que tienes capturadas aquí se conservan para que puedas guardarlas después.</p>
                  <UAlert v-if="errorMessage" :title="errorMessage" color="error" />
                  <div class="flex justify-end gap-3">
                    <UButton
                      label="Cancelar"
                      color="neutral"
                      variant="outline"
                      :disabled="checking"
                      @click="discardOpen = false"
                    />
                    <UButton label="Conservar datos actuales y desbloquear" :loading="checking" @click="unlock" />
                  </div>
                </div>
              </template>
            </UModal>
          </template>
        </UAlert>
        <UAlert
          v-if="duplicateFrom"
          title="Revisa los datos de la copia e ingresa un código nuevo."
          description="El producto se creará al guardar. La imagen y las existencias del producto original no se copian."
          color="info"
          variant="subtle"
        />
        <UAlert v-if="errorMessage" :title="errorMessage" color="error" />
        <div v-if="ambiguous" class="space-y-3 rounded-lg border border-warning p-4">
          <UButton label="Consultar resultado en Siigo" :loading="checking" @click="recover" />
          <div v-for="result in lookupResults" :key="result.id" class="space-y-1">
            <p>{{ result.code }} · {{ result.name }} · {{ result.active ? 'Activo' : 'Inactivo' }}</p>
            <UButton :to="{ path: `/productos/${result.id}`, query: { returnTo } }" label="Abrir producto para revisar" variant="outline" />
          </div>
          <p class="text-sm text-muted">
            Revisa el producto antes de iniciar otro guardado; Siigo pudo procesar la solicitud.
          </p>
        </div>
        <ProductsProductImageField
          v-if="productId && product"
          v-model:image="productImage"
          class="ring-0"
          :product-id="productId"
          :product-name="product.name"
        />
        <ProductsProductForm
          :product="product"
          :duplicate="Boolean(duplicateFrom)"
          :context="context"
          :saving="saving"
          :blocked="ambiguous || hasPendingWrite || checking"
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
