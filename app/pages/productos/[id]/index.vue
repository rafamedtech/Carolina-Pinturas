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

const MANAGED_TYPES = ['Product']

const productName = computed(() => product.value?.name || 'Detalle de producto')
const isManaged = computed(() => MANAGED_TYPES.includes(product.value?.type || 'Product'))
const unit = computed(() => {
  const value = product.value?.unit
  return typeof value === 'string' ? { code: value, name: undefined } : value
})
const prices = computed(() => product.value?.prices?.flatMap(price =>
  (price.price_list || []).map(item => ({ ...item, currency: price.currency_code || 'MXN' }))
) || [])
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el producto.')

const generalFields = computed(() => {
  const item = product.value
  if (!item) return []
  return [
    { label: 'Creado', value: formatMexicoDateTime(item.metadata?.created) },
    { label: 'Última actualización', value: formatMexicoDateTime(item.metadata?.last_updated) },
    { label: 'Grupo', value: item.account_group?.name },
    { label: 'Tipo', value: item.internal?.composition?.kind === 'composite' ? 'Producto compuesto' : item.type === 'Product' || !item.type ? 'Producto' : item.type },
    { label: 'Marca', value: item.additional_fields?.brand },
    { label: 'Control de inventario', value: item.internal?.composition?.kind === 'composite' ? 'Control por componentes' : item.internal?.inventory?.tracked ? 'Controlado' : 'Sin control' }
  ]
})
const fiscalFields = computed(() => {
  const item = product.value
  if (!item) return []
  return [
    { label: 'Clave SAT', value: joinParts(item.key?.code, item.key?.name) },
    { label: 'Unidad SAT', value: joinParts(unit.value?.code, unit.value?.name) },
    { label: 'Impuestos incluidos', value: item.tax_included === undefined ? undefined : item.tax_included ? 'Sí' : 'No' }
  ]
})

useSeoMeta({ title: () => productName.value })

function joinParts(...parts: Array<string | number | undefined>) {
  return parts.filter(part => part !== undefined && part !== '').join(' · ') || undefined
}

function formatCurrency(value?: number | string, currencyCode = 'MXN') {
  const amount = typeof value === 'string' ? Number(value) : value
  if (amount === undefined || !Number.isFinite(amount)) return '—'

  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currencyCode, currencyDisplay: 'narrowSymbol' }).format(amount)
}

function formatQuantity(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 }).format(value)
}
</script>

<template>
  <UDashboardPanel id="product-detail">
    <template #header>
      <UDashboardNavbar title="Detalle del producto">
        <template #leading>
          <UButton
            :to="backPath"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a productos"
          />
        </template>
        <template #right>
          <template v-if="product && canManageProducts(user?.role) && isManaged">
            <UButton
              :to="{ path: '/productos/nuevo', query: { duplicar: productId, returnTo: backPath } }"
              label="Duplicar"
              icon="i-lucide-copy"
              color="neutral"
              variant="outline"
            />
            <UButton :to="{ path: `/productos/${productId}/editar`, query: { returnTo: backPath } }" label="Editar" icon="i-lucide-pencil" />
            <ProductsProductStatusAction :product="product" @changed="refresh" />
          </template>
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="syncing || ['idle', 'pending'].includes(status)"
            @click="syncProduct"
          />
        </template>
      </UDashboardNavbar>
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
          title="Guardado pendiente de conciliación"
          description="Este producto no está disponible para nuevas ventas hasta revisar su guardado desde Editar."
          color="warning"
        />
        <UAlert
          v-if="!isManaged"
          title="Este tipo de producto se conserva para consulta histórica."
          description="No está disponible para nuevas ventas."
          color="neutral"
        />

        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm text-muted">
              {{ product.code }}
            </p>
            <h1 class="text-xl font-semibold text-primary break-words">
              {{ product.name }}
            </h1>
            <p v-if="product.reference" class="mt-1 text-sm text-muted">
              Referencia: {{ product.reference }}
            </p>
          </div>
          <UBadge :color="product.active === false ? 'neutral' : 'success'" variant="subtle" size="lg">
            {{ product.active === false ? 'Inactivo' : 'Activo' }}
          </UBadge>
        </div>

        <div v-if="isManaged" class="flex flex-wrap gap-2" aria-label="Disponibilidad interna">
          <UBadge :color="product.internal?.availability?.purchase === false ? 'neutral' : 'success'" variant="subtle" :aria-label="`Compra: ${product.internal?.availability?.purchase === false ? 'No' : 'Sí'}`">
            Compra
          </UBadge>
          <UBadge :color="product.internal?.availability?.sale === false ? 'neutral' : 'success'" variant="subtle" :aria-label="`Venta directa: ${product.internal?.availability?.sale === false ? 'No' : 'Sí'}`">
            Venta directa
          </UBadge>
          <UBadge :color="product.internal?.availability?.expense === false ? 'neutral' : 'success'" variant="subtle" :aria-label="`Gasto: ${product.internal?.availability?.expense === false ? 'No' : 'Sí'}`">
            Gasto
          </UBadge>
        </div>

        <div class="grid gap-4 lg:grid-cols-3">
          <div class="flex flex-col gap-4 lg:col-span-2">
            <UCard v-if="product.internal?.composition?.kind === 'composite'">
              <template #header>
                <h2 class="font-semibold text-primary">
                  Componentes por unidad
                </h2>
              </template>
              <ul class="divide-y divide-default">
                <li v-for="component in product.internal.composition.components" :key="component.productId" class="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>{{ component.code }} · {{ component.name ?? component.productId }}</span>
                  <span class="shrink-0 font-medium tabular-nums">{{ component.quantity }} {{ component.unit }}</span>
                </li>
              </ul>
              <p class="mt-3 text-sm text-muted">
                Se reserva al confirmar el pedido y se descuenta al surtir. Este producto no tiene existencias propias.
              </p>
            </UCard>
            <UCard>
              <template #header>
                <h2 class="font-semibold text-primary">
                  Información general
                </h2>
              </template>
              <dl class="grid gap-4 sm:grid-cols-2">
                <div
                  v-for="field in generalFields"
                  :key="field.label"
                  class="min-w-0"
                >
                  <dt class="text-sm text-muted">
                    {{ field.label }}
                  </dt>
                  <dd class="mt-1 font-medium break-words">
                    {{ field.value || '—' }}
                  </dd>
                </div>
              </dl>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="font-semibold text-primary">
                  Listas de precios
                </h2>
              </template>
              <div v-if="prices.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div v-for="price in prices" :key="`${price.currency}-${price.position}`" class="rounded-lg border border-default p-3">
                  <p class="text-sm text-muted">
                    {{ price.name || `Lista ${price.position ?? '—'}` }}
                  </p>
                  <p class="mt-1 text-lg font-semibold text-highlighted">
                    {{ formatCurrency(price.value, price.currency) }}
                    <span class="text-sm font-normal text-muted">{{ price.currency }}</span>
                  </p>
                </div>
              </div>
              <p v-else class="text-sm text-muted">
                Sin precios registrados.
              </p>
            </UCard>

            <UCard v-if="product.components?.length">
              <template #header>
                <h2 class="font-semibold text-primary">
                  Componentes
                </h2>
              </template>
              <ul class="space-y-3">
                <li v-for="component in product.components" :key="component.id || component.name" class="flex items-center justify-between gap-3 text-sm">
                  <span class="min-w-0">
                    <span class="block">{{ component.name || component.id }}</span>
                    <span v-if="component.name && component.id" class="block text-xs text-muted">ID {{ component.id }}</span>
                  </span>
                  <span class="font-medium">{{ formatQuantity(component.quantity) }}</span>
                </li>
              </ul>
            </UCard>
          </div>

          <div class="flex flex-col gap-4">
            <UCard v-if="product.internal?.image" :ui="{ body: 'p-0 sm:p-0' }">
              <div class="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-elevated">
                <img
                  :src="product.internal.image.url"
                  :alt="product.name"
                  width="480"
                  height="480"
                  loading="lazy"
                  decoding="async"
                  class="size-full object-contain"
                >
              </div>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="font-semibold text-primary">
                  Datos fiscales
                </h2>
              </template>
              <dl class="grid gap-4">
                <div v-for="field in fiscalFields" :key="field.label" class="min-w-0">
                  <dt class="text-sm text-muted">
                    {{ field.label }}
                  </dt>
                  <dd class="mt-1 font-medium break-words">
                    {{ field.value || '—' }}
                  </dd>
                </div>
              </dl>
            </UCard>
            <InventoryProductStock v-if="product.internal?.composition?.kind !== 'composite'" :product-id="productId" />
          </div>
        </div>
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
