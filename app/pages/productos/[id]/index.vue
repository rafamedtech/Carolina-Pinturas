<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'
import { canManageProducts } from '~/utils/roleAccess'

const { user } = useAuth()

const route = useRoute()
const productId = computed(() => String(route.params.id))
const { data: product, status, error, refresh } = useLazyFetch<SiigoProduct>(
  () => `/api/siigo/products/${encodeURIComponent(productId.value)}`,
  { key: () => `siigo-product-${productId.value}`, query: { refresh: 'true' } }
)

const MANAGED_TYPES = ['Product', 'Service', 'ConsumerGood']

const productName = computed(() => product.value?.name || 'Detalle de producto')
const isManaged = computed(() => MANAGED_TYPES.includes(product.value?.type || 'Product'))
const unit = computed(() => {
  const value = product.value?.unit
  return typeof value === 'string' ? { code: value, name: undefined } : value
})
const prices = computed(() => product.value?.prices?.flatMap(price =>
  (price.price_list || []).map(item => ({ ...item, currency: price.currency_code || 'MXN' }))
) || [])
const warehouseTotal = computed(() =>
  product.value?.warehouses?.reduce((total, warehouse) => total + (warehouse.quantity ?? 0), 0) ?? 0
)
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el producto.')

const generalFields = computed(() => {
  const item = product.value
  if (!item) return []
  return [
    { label: 'Creado', value: formatDateTime(item.metadata?.created) },
    { label: 'Última actualización', value: formatDateTime(item.metadata?.last_updated) },
    { label: 'Descripción', value: item.description, multiline: true },
    { label: 'Marca', value: item.additional_fields?.brand },
    { label: 'Grupo', value: item.account_group?.name },
    { label: 'Control de inventario', value: item.stock_control === undefined ? undefined : item.stock_control ? 'Controlado' : 'Sin control' },
    { label: 'Existencia disponible', value: formatQuantity(item.available_quantity) }
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

function formatDateTime(value?: string | null) {
  if (!value || formatMexicoDate(value) === '—') return '—'
  return formatMexicoDateTime(value)
}
</script>

<template>
  <UDashboardPanel id="product-detail">
    <template #header>
      <UDashboardNavbar title="Detalle del producto">
        <template #leading>
          <UButton
            to="/productos"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a productos"
          />
        </template>
        <template #right>
          <template v-if="product && canManageProducts(user?.role) && isManaged">
            <UButton :to="`/productos/${productId}/editar`" label="Editar" icon="i-lucide-pencil" />
            <ProductsProductStatusAction :product="product" @changed="refresh" />
          </template>
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="status === 'pending'"
            @click="() => refresh()"
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

      <template v-else-if="product">
        <UAlert
          v-if="!isManaged"
          title="Este tipo de producto se administra directamente en Siigo."
          description="Puedes consultar sus datos y componentes aquí."
          color="neutral"
        />

        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm text-muted">
              {{ product.code }}
            </p>
            <h1 class="text-xl font-semibold text-highlighted break-words">
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

        <div class="grid gap-4 lg:grid-cols-3">
          <div class="flex flex-col gap-4 lg:col-span-2">
            <UCard>
              <template #header>
                <h2 class="font-semibold text-highlighted">
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
                  <dd class="mt-1 font-medium break-words" :class="{ 'whitespace-pre-wrap': field.multiline }">
                    {{ field.value || '—' }}
                  </dd>
                </div>
              </dl>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="font-semibold text-highlighted">
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

            <UCard>
              <template #header>
                <h2 class="font-semibold text-highlighted">
                  Existencia por almacén
                </h2>
              </template>
              <ul v-if="product.warehouses?.length" class="space-y-3">
                <li v-for="warehouse in product.warehouses" :key="String(warehouse.id)" class="flex items-center justify-between gap-3 text-sm">
                  <span>{{ warehouse.name || 'Almacén' }}</span><span class="font-medium">{{ formatQuantity(warehouse.quantity) }}</span>
                </li>
                <li class="flex items-center justify-between gap-3 border-t border-default pt-3 text-sm">
                  <span class="text-muted">Total</span><span class="font-semibold text-highlighted">{{ formatQuantity(warehouseTotal) }}</span>
                </li>
              </ul>
              <p v-else class="text-sm text-muted">
                Sin almacenes registrados.
              </p>
            </UCard>

            <UCard v-if="product.components?.length">
              <template #header>
                <h2 class="font-semibold text-highlighted">
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
                <h2 class="font-semibold text-highlighted">
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
          </div>
        </div>
      </template>

      <div
        v-else-if="status === 'pending'"
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
