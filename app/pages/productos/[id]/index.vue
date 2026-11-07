<script setup lang="ts">
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
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el producto.')

useSeoMeta({ title: () => productName.value })
</script>

<template>
  <UDashboardPanel id="product-detail">
    <template #header>
      <UDashboardNavbar title="Detalle del producto">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Actualizar"
            aria-label="Actualizar producto desde Siigo"
            :ui="{ label: 'hidden sm:inline' }"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="syncing || ['idle', 'pending'].includes(status)"
            @click="syncProduct"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <UBreadcrumb
          :items="[
            { label: 'Productos', icon: 'i-lucide-package', to: backPath },
            { label: product?.name || 'Detalle' }
          ]"
        />
      </UDashboardToolbar>
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

      <template v-if="product">
        <UAlert
          v-if="product.internal?.syncPending"
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
          v-if="!isManaged"
          title="Este tipo de producto se conserva para consulta histórica."
          description="No está disponible para nuevas ventas."
          color="neutral"
        />

        <UPageHeader :title="product.name" :ui="{ root: 'pt-0 pb-5', title: 'text-xl sm:text-2xl font-semibold' }">
          <template #title>
            <span class="flex min-w-0 items-center gap-3">
              <UAvatar
                :src="product.internal?.image?.url"
                icon="i-lucide-package"
                size="3xl"
                :ui="{ image: 'object-contain' }"
              />
              <span class="min-w-0">
                <span class="mb-1 block font-mono text-sm font-normal text-muted">{{ product.code }}</span>
                <span class="block break-words">{{ product.name }}</span>
              </span>
            </span>
          </template>
          <template #description>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
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
                  variant="outline"
                >
                  {{ label }}
                </UBadge>
              </template>
            </div>
          </template>
          <template v-if="canManageProducts(user?.role) && isManaged" #links>
            <UButton
              :to="{ path: '/productos/nuevo', query: { duplicar: productId, returnTo: backPath } }"
              label="Duplicar"
              icon="i-lucide-copy"
              color="neutral"
              variant="outline"
            />
            <ProductsProductStatusAction :product="product" @changed="refresh" />
            <UButton :to="{ path: `/productos/${productId}/editar`, query: { returnTo: backPath } }" label="Editar" icon="i-lucide-pencil" />
          </template>
        </UPageHeader>
        <ProductsProductDetailFields :product="product" :show-purchase-cost="canManageProducts(user?.role)" />
        <InventoryProductStock v-if="!isComposite" :product-id="productId" />
        <ProductsProductActivity
          :key="productId"
          :product-id="productId"
          :composite="isComposite"
          :role="user?.role"
        />
      </template>

      <div
        v-else-if="['idle', 'pending'].includes(status)"
        class="flex flex-col gap-6"
        role="status"
        aria-busy="true"
      >
        <div class="flex flex-col gap-2">
          <USkeleton class="h-4 w-24" />
          <USkeleton class="h-7 w-64" />
          <USkeleton class="h-4 w-40" />
        </div>
        <div class="grid gap-4 lg:grid-cols-3">
          <USkeleton class="h-72 w-full rounded-lg lg:col-span-2" />
          <USkeleton class="h-72 w-full rounded-lg" />
        </div>
        <span class="sr-only">Cargando producto…</span>
      </div>
    </template>
  </UDashboardPanel>
</template>
