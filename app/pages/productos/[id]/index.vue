<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { tableReturnPath } from '~/utils/tableQuery'
import type { SiigoProduct } from '~/types/siigo'
import { canManageProducts } from '~/utils/roleAccess'

const { user } = useAuth()

const route = useRoute()
const backPath = computed(() => tableReturnPath(route.query.returnTo, '/productos'))
const productId = computed(() => String(route.params.id))
const { data: product, status, error, refresh } = useLazyFetch<SiigoProduct>(
  () => `/api/siigo/products/${encodeURIComponent(productId.value)}`,
  { lazy: true, server: false, key: () => `siigo-product-${productId.value}` }
)

const syncing = shallowRef(false)
const statusOpen = shallowRef(false)
const productActions = computed<DropdownMenuItem[]>(() => [
  {
    label: 'Duplicar',
    icon: 'i-lucide-copy',
    to: { path: '/productos/nuevo', query: { duplicar: productId.value, returnTo: backPath.value } }
  },
  product.value?.internal?.syncPending
    ? {
        label: 'Resolver guardado pendiente',
        icon: 'i-lucide-circle-alert',
        to: { path: `/productos/${productId.value}/editar`, query: { returnTo: backPath.value } }
      }
    : {
        label: product.value?.active === false ? 'Activar' : 'Desactivar',
        icon: product.value?.active === false ? 'i-lucide-circle-check' : 'i-lucide-ban',
        onSelect: () => { statusOpen.value = true }
      },
  {
    label: 'Editar',
    icon: 'i-lucide-pencil',
    to: { path: `/productos/${productId.value}/editar`, query: { returnTo: backPath.value } }
  }
])
const toast = useToast()
async function syncProduct() {
  if (syncing.value) return
  syncing.value = true
  try {
    await $fetch(`/api/siigo/products/${encodeURIComponent(productId.value)}`, { query: { refresh: 'true' } })
    await Promise.all([refresh(), refreshNuxtData(['products-catalog-request', 'product-management-catalog', 'product-brand-options'])])
  } catch (error) {
    toast.add({ title: 'No se pudo actualizar el producto desde Siigo', description: (error as { data?: { statusMessage?: string } }).data?.statusMessage, color: 'error' })
  } finally {
    syncing.value = false
  }
}

const availabilityFields = [
  { key: 'purchase', label: 'Compra' },
  { key: 'sale', label: 'Venta directa' },
  { key: 'expense', label: 'Gasto' }
] as const

const MANAGED_TYPES = ['Product']

const isComposite = computed(() => product.value?.internal?.composition?.kind === 'composite')
const productName = computed(() => product.value?.name || 'Detalle de producto')
const isManaged = computed(() => MANAGED_TYPES.includes(product.value?.type || 'Product'))
const initialLoading = computed(() => !product.value && ['idle', 'pending'].includes(status.value))
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el producto.')

useSeoMeta({ title: () => productName.value })
</script>

<template>
  <UDashboardPanel id="product-detail">
    <template #header>
      <DetailHeader
        title="Detalle del producto"
        :breadcrumbs="[
          { label: 'Productos', icon: 'i-lucide-package', to: backPath },
          { label: product?.name || 'Detalle' }
        ]"
        refresh-label="Actualizar producto desde Siigo"
        :loading="syncing || ['idle', 'pending'].includes(status)"
        @refresh="syncProduct"
      />
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Producto no disponible"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <template v-if="product || initialLoading">
        <UAlert
          v-if="product?.internal?.syncPending"
          class="shrink-0"
          title="Guardado pendiente de conciliación"
          :description="canManageProducts(user?.role) ? 'Revisa la comparación y elige volver a enviar, corregir o descartar los cambios pendientes. El producto se habilita al resolver el intento.' : 'Un administrador debe resolver los cambios pendientes para habilitar el producto en nuevas ventas.'"
          color="warning"
        >
          <template v-if="canManageProducts(user?.role)" #actions>
            <UButton :to="{ path: `/productos/${productId}/editar`, query: { returnTo: backPath } }" label="Resolver guardado pendiente" icon="i-lucide-arrow-right" />
          </template>
        </UAlert>
        <UAlert
          v-if="product && !isManaged"
          title="Este tipo de producto se conserva para consulta histórica."
          description="No está disponible para nuevas ventas."
          color="neutral"
        />

        <UPageHeader :title="product?.name" :ui="{ root: 'pt-0 pb-5', title: 'min-w-0 flex-1 text-xl sm:text-2xl font-semibold', links: 'hidden sm:flex' }">
          <template #title>
            <span class="flex w-full min-w-0 items-center gap-3">
              <UAvatar
                :src="product?.internal?.image?.url"
                icon="i-lucide-package"
                size="3xl"
                :ui="{ image: 'object-contain' }"
              />
              <span class="min-w-0 flex-1">
                <USkeleton v-if="initialLoading" class="mb-2 h-4 w-20" />
                <span v-else class="mb-1 block font-mono text-sm font-normal text-primary">{{ product?.code }}</span>
                <USkeleton v-if="initialLoading" class="h-7 w-64 max-w-full" />
                <span v-else class="block break-words">{{ product?.name }}</span>
              </span>
              <UDropdownMenu
                v-if="product && canManageProducts(user?.role) && isManaged"
                :items="productActions"
                :content="{ align: 'end' }"
                class="shrink-0 sm:hidden"
              >
                <UButton
                  icon="i-lucide-settings-2"
                  color="neutral"
                  variant="outline"
                  aria-label="Acciones del producto"
                />
              </UDropdownMenu>
            </span>
          </template>
          <template #description>
            <div v-if="product" class="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span v-if="product.reference">Ref. {{ product.reference }}</span>
              <UBadge v-if="product.active === false" color="neutral" variant="subtle">
                Inactivo
              </UBadge>
              <template v-if="isManaged">
                <UBadge
                  v-for="{ key, label } in availabilityFields"
                  :key="key"
                  :color="product.internal?.availability?.[key] === false ? 'neutral' : 'success'"
                  :aria-label="`${label}: ${product.internal?.availability?.[key] === false ? 'No disponible' : 'Disponible'}`"
                  variant="subtle"
                >
                  {{ label }}
                </UBadge>
              </template>
            </div>
          </template>
          <template v-if="product && canManageProducts(user?.role) && isManaged" #links>
            <UButton
              :to="{ path: '/productos/nuevo', query: { duplicar: productId, returnTo: backPath } }"
              label="Duplicar"
              icon="i-lucide-copy"
              color="neutral"
              variant="outline"
              class="hidden sm:inline-flex"
            />
            <ProductsProductStatusAction
              v-model:open="statusOpen"
              :product="product"
              trigger-class="hidden sm:inline-flex"
              @changed="refresh"
            />
            <UButton
              :to="{ path: `/productos/${productId}/editar`, query: { returnTo: backPath } }"
              label="Editar"
              icon="i-lucide-pencil"
              class="hidden sm:inline-flex"
            />
          </template>
        </UPageHeader>
        <ProductsProductDetailFields
          :product="product"
          :product-id="productId"
          :loading="initialLoading"
          :show-purchase-cost="canManageProducts(user?.role)"
        />
        <InventoryProductStock v-if="!isComposite" :product-id="productId" />
        <ProductsProductActivity
          :key="productId"
          :product-id="productId"
          :composite="isComposite"
          :role="user?.role"
        />
      </template>
    </template>
  </UDashboardPanel>
</template>
