<script setup lang="ts">
import { tableReturnPath } from '~/utils/tableQuery'
import type { SiigoProduct } from '~/types/siigo'
import type { ProductContext, ProductImage, ProductInput } from '~/types/siigo-products'
import { canManageProducts } from '~/utils/roleAccess'
import { productMutationInput } from '~/utils/siigoProductMutation'

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
const { saving, errorMessage, ambiguous, checking, operationId, save, check, clearPending } = useProductMutation()
const discardedWriteIds = shallowRef<string[]>([])
const formDraft = shallowRef<ProductInput>()
const confirmedVersion = shallowRef<number>()
const resolutionNotice = shallowRef('')
const pendingWriteId = computed(() => ambiguous.value && operationId.value ? operationId.value : product.value?.internal?.pendingWriteId)
const hasPendingWrite = computed(() => Boolean(pendingWriteId.value && !discardedWriteIds.value.includes(pendingWriteId.value)
  && ((props.productId && product.value?.internal?.syncPending) || (ambiguous.value && operationId.value))))
function restored(previous: SiigoProduct) {
  discardedWriteIds.value = [...discardedWriteIds.value, pendingWriteId.value || '']
  clearPending()
  product.value = { ...previous, internal: { ...previous.internal, image: productImage.value } }
  formDraft.value = productMutationInput(previous)
  errorMessage.value = 'No se guardaron los cambios. Se conservaron los valores anteriores de Siigo.'
}
function resolved(result: { operationIds: string[], input?: ProductInput }) {
  discardedWriteIds.value = [...discardedWriteIds.value, ...result.operationIds, pendingWriteId.value || '']
  clearPending()
  if (result.input) {
    formDraft.value = result.input
  }
  resolutionNotice.value = result.input ? 'Cambios pendientes cargados. Revisa el formulario y pulsa Guardar cambios.' : 'Intento descartado. Se conservaron los datos actuales de Siigo y el producto quedó desbloqueado.'
}
async function recovered(saved: SiigoProduct) {
  discardedWriteIds.value = [...discardedWriteIds.value, pendingWriteId.value || '']
  clearPending()
  product.value = { ...saved, internal: { ...saved.internal, image: productImage.value } }
  confirmedVersion.value = saved.internal?.composition?.version
  resolutionNotice.value = 'Guardado confirmado. El producto vuelve a estar disponible para nuevas ventas.'
  await refreshNuxtData(['products-catalog-request', 'product-management-catalog', 'product-brand-options']).catch(() => undefined)
  if (!props.productId) await navigateTo(`/productos/${saved.id}`)
}
async function recover() {
  if (props.productId && !operationId.value) {
    try {
      const latest = await $fetch<SiigoProduct>(`/api/siigo/products/${encodeURIComponent(props.productId)}`)
      product.value = latest
      if (latest.internal?.pendingWriteId && !discardedWriteIds.value.includes(latest.internal.pendingWriteId)) return
    } catch {
      errorMessage.value = 'No se pudo localizar el intento pendiente. Conserva el formulario y vuelve a comprobar.'
      return
    }
  }
  const saved = await check(props.productId, pendingWriteId.value)
  if (saved) await recovered(saved)
}
async function submit(input: ProductInput) {
  resolutionNotice.value = ''
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
        <ProductsProductWriteRecovery
          v-if="hasPendingWrite && pendingWriteId"
          :operation-id="pendingWriteId"
          :context="context"
          :failure-message="errorMessage"
          @recovered="recovered"
          @resolved="resolved"
          @restored="restored"
        />
        <UAlert
          v-if="resolutionNotice"
          class="shrink-0"
          :title="resolutionNotice"
          color="success"
          variant="subtle"
        />
        <UAlert
          v-if="duplicateFrom"
          title="Revisa los datos de la copia e ingresa un código nuevo."
          description="El producto se creará al guardar. La imagen y las existencias del producto original no se copian."
          color="info"
          variant="subtle"
        />
        <UAlert
          v-if="errorMessage && !hasPendingWrite"
          class="shrink-0"
          :title="errorMessage"
          color="error"
        />
        <div v-if="ambiguous && !hasPendingWrite" class="shrink-0 space-y-3 rounded-lg border border-warning p-4">
          <p class="text-sm">
            La respuesta del guardado no llegó. Tus cambios siguen en el formulario. Comprueba el resultado antes de guardar otra vez.
          </p>
          <UButton label="Comprobar resultado" :loading="checking" @click="recover" />
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
          :draft="formDraft"
          :confirmed-version="confirmedVersion"
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
