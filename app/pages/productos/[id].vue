<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'

const route = useRoute()
const productId = computed(() => String(route.params.id))
const { data: product, status, error, refresh } = useLazyFetch<SiigoProduct>(
  () => `/api/siigo/products/${encodeURIComponent(productId.value)}`,
  { key: () => `siigo-product-${productId.value}` }
)

const productName = computed(() => product.value?.name || 'Detalle de producto')
const prices = computed(() => product.value?.prices?.flatMap(price =>
  (price.price_list || []).map(item => ({ ...item, currency: price.currency_code || 'MXN' }))
) || [])
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar el producto.')

useSeoMeta({ title: () => productName.value })

function formatCurrency(value?: number | string, currencyCode = 'MXN') {
  const amount = typeof value === 'string' ? Number(value) : value
  if (amount === undefined || !Number.isFinite(amount)) return '—'

  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currencyCode }).format(amount)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return formatMexicoDate(value)
}
</script>

<template>
  <UDashboardPanel id="product-detail">
    <template #header>
      <UDashboardNavbar :title="productName">
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
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm text-muted">
              {{ product.code }}
            </p>
            <h1 class="text-xl font-semibold text-highlighted">
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

        <div class="grid gap-4 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Información general
              </h2>
            </template>
            <dl class="grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-muted">
                  Unidad
                </dt><dd class="mt-1 font-medium">
                  {{ product.unit || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Marca
                </dt><dd class="mt-1 font-medium">
                  {{ product.additional_fields?.brand || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Tipo
                </dt><dd class="mt-1 font-medium">
                  {{ product.type || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Grupo contable
                </dt><dd class="mt-1 font-medium">
                  {{ product.account_group?.name || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Código de barras
                </dt><dd class="mt-1 font-medium">
                  {{ product.additional_fields?.barcode || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Impuestos incluidos
                </dt><dd class="mt-1 font-medium">
                  {{ product.tax_included ? 'Sí' : 'No' }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Inventario y trazabilidad
              </h2>
            </template>
            <dl class="grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-muted">
                  Control de inventario
                </dt><dd class="mt-1 font-medium">
                  {{ product.stock_control ? 'Controlado' : 'Sin control' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Existencia disponible
                </dt><dd class="mt-1 font-medium">
                  {{ product.available_quantity ?? '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Creado
                </dt><dd class="mt-1 font-medium">
                  {{ formatDate(product.metadata?.created) }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Última actualización
                </dt><dd class="mt-1 font-medium">
                  {{ formatDate(product.metadata?.last_updated) }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>

        <UCard v-if="prices.length" class="shrink-0">
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Listas de precios
            </h2>
          </template>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="price in prices" :key="`${price.currency}-${price.position}`" class="rounded-lg border border-default p-3">
              <p class="text-sm text-muted">
                Lista {{ price.position || '—' }}
              </p>
              <p class="mt-1 text-lg font-semibold text-highlighted">
                {{ formatCurrency(price.value, price.currency) }}
              </p>
            </div>
          </div>
        </UCard>

        <div class="grid gap-4 lg:grid-cols-2">
          <UCard v-if="product.taxes?.length">
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Impuestos
              </h2>
            </template>
            <ul class="space-y-3">
              <li v-for="tax in product.taxes" :key="String(tax.id)" class="flex items-center justify-between gap-3 text-sm">
                <span>{{ tax.name || tax.type || 'Impuesto' }}</span><span class="font-medium">{{ tax.percentage ?? 0 }}%</span>
              </li>
            </ul>
          </UCard>
          <UCard v-if="product.warehouses?.length">
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Existencia por almacén
              </h2>
            </template>
            <ul class="space-y-3">
              <li v-for="warehouse in product.warehouses" :key="String(warehouse.id)" class="flex items-center justify-between gap-3 text-sm">
                <span>{{ warehouse.name || 'Almacén' }}</span><span class="font-medium">{{ warehouse.quantity ?? '—' }}</span>
              </li>
            </ul>
          </UCard>
        </div>

        <UCard v-if="product.components?.length" class="shrink-0">
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Componentes
            </h2>
          </template>
          <ul class="space-y-3">
            <li v-for="component in product.components" :key="component.id || component.name" class="flex items-center justify-between gap-3 text-sm">
              <span>{{ component.name || component.id }}</span><span class="font-medium">{{ component.quantity ?? '—' }}</span>
            </li>
          </ul>
        </UCard>

        <UCard v-if="product.description" class="shrink-0">
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Descripción
            </h2>
          </template>
          <p class="whitespace-pre-wrap break-words text-sm">
            {{ product.description }}
          </p>
        </UCard>
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
        <USkeleton class="h-48 w-full rounded-lg" />
        <USkeleton class="h-32 w-full rounded-lg" />
        <span class="sr-only">Cargando producto…</span>
      </div>
    </template>
  </UDashboardPanel>
</template>
