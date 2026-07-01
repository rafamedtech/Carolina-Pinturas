<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'

const props = defineProps<{
  product: SiigoProduct
}>()

const { data: fetchedProduct, status, error } = useLazyFetch<SiigoProduct>(
  () => `/api/siigo/products/${encodeURIComponent(props.product.id)}`,
  { key: `order-product-detail-${props.product.id}` }
)

const product = computed(() => fetchedProduct.value ?? props.product)
const prices = computed(() => product.value.prices?.flatMap(price =>
  (price.price_list || []).map(item => ({
    ...item,
    currency: price.currency_code || 'MXN'
  }))
) || [])
const details = computed(() => [
  { label: 'Referencia', value: product.value.reference || '—' },
  {
    label: 'Unidad',
    value: product.value.unit?.name || product.value.unit?.code || '—'
  },
  { label: 'Tipo', value: product.value.type || '—' },
  { label: 'Marca', value: product.value.additional_fields?.brand || '—' },
  {
    label: 'Código de barras',
    value: product.value.additional_fields?.barcode || '—'
  },
  {
    label: 'Grupo contable',
    value: product.value.account_group?.name || '—'
  },
  {
    label: 'Control de inventario',
    value: product.value.stock_control ? 'Controlado' : 'Sin control'
  },
  {
    label: 'Impuestos incluidos',
    value: product.value.tax_included ? 'Sí' : 'No'
  },
  {
    label: 'Creado',
    value: formatDate(product.value.metadata?.created)
  },
  {
    label: 'Última actualización',
    value: formatDate(product.value.metadata?.last_updated)
  }
])
const availability = computed(() => {
  if (!product.value.stock_control) return 'Sin control de inventario'
  if (product.value.available_quantity === undefined) return 'No disponible'

  return `${product.value.available_quantity.toLocaleString('es-MX')} unidades`
})

function formatCurrency(value?: number | string, currencyCode = 'MXN') {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '—'

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currencyCode
  }).format(amount)
}

function formatDate(value?: string | null) {
  if (!value) return '—'

  return new Date(value).toLocaleDateString('es-MX')
}
</script>

<template>
  <section class="rounded-xl border border-default bg-elevated/40 p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">
          Detalle del producto
        </p>
        <h3 class="mt-1 break-words font-semibold text-highlighted">
          {{ product.name }}
        </h3>
        <p class="mt-0.5 text-sm text-muted">
          Código: {{ product.code || '—' }}
        </p>
      </div>

      <UBadge
        :color="product.active === false ? 'neutral' : 'success'"
        variant="subtle"
      >
        {{ product.active === false ? 'Inactivo' : 'Activo' }}
      </UBadge>
    </div>

    <div class="mt-4 rounded-lg bg-primary/10 p-3">
      <p class="text-xs font-medium text-primary">
        Existencia disponible
      </p>
      <p class="mt-1 text-lg font-semibold tabular-nums text-highlighted">
        {{ availability }}
      </p>
    </div>

    <p v-if="status === 'pending'" class="mt-3 flex items-center gap-2 text-xs text-muted">
      <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
      Cargando el detalle actualizado…
    </p>
    <p v-else-if="error" class="mt-3 text-xs text-warning">
      No fue posible actualizar el detalle; se muestran los datos del catálogo.
    </p>

    <dl class="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
      <div v-for="detail in details" :key="detail.label" class="min-w-0">
        <dt class="text-xs text-muted">
          {{ detail.label }}
        </dt>
        <dd class="mt-0.5 break-words text-sm font-medium text-highlighted">
          {{ detail.value }}
        </dd>
      </div>
    </dl>

    <div v-if="prices.length" class="mt-4 border-t border-default pt-4">
      <h4 class="text-sm font-medium text-highlighted">
        Listas de precios
      </h4>
      <ul class="mt-2 grid gap-2 sm:grid-cols-2">
        <li
          v-for="price in prices"
          :key="`${price.currency}-${price.position}-${price.name}`"
          class="flex items-center justify-between gap-3 rounded-lg border border-default px-3 py-2 text-sm"
        >
          <span class="truncate text-muted">
            {{ price.name || `Lista ${price.position || '—'}` }}
          </span>
          <span class="shrink-0 font-medium tabular-nums text-highlighted">
            {{ formatCurrency(price.value, price.currency) }}
          </span>
        </li>
      </ul>
    </div>

    <div v-if="product.warehouses?.length" class="mt-4 border-t border-default pt-4">
      <h4 class="text-sm font-medium text-highlighted">
        Existencia por almacén
      </h4>
      <ul class="mt-2 space-y-2">
        <li
          v-for="warehouse in product.warehouses"
          :key="String(warehouse.id || warehouse.name)"
          class="flex items-center justify-between gap-3 text-sm"
        >
          <span class="text-muted">{{ warehouse.name || 'Almacén' }}</span>
          <span class="font-medium tabular-nums text-highlighted">
            {{ warehouse.quantity?.toLocaleString('es-MX') ?? '—' }}
          </span>
        </li>
      </ul>
    </div>

    <div v-if="product.taxes?.length" class="mt-4 border-t border-default pt-4">
      <h4 class="text-sm font-medium text-highlighted">
        Impuestos
      </h4>
      <ul class="mt-2 space-y-2">
        <li
          v-for="tax in product.taxes"
          :key="String(tax.id || tax.name)"
          class="flex items-center justify-between gap-3 text-sm"
        >
          <span class="text-muted">{{ tax.name || tax.type || 'Impuesto' }}</span>
          <span class="font-medium tabular-nums text-highlighted">
            {{ tax.percentage ?? 0 }}%
          </span>
        </li>
      </ul>
    </div>

    <div v-if="product.components?.length" class="mt-4 border-t border-default pt-4">
      <h4 class="text-sm font-medium text-highlighted">
        Componentes
      </h4>
      <ul class="mt-2 space-y-2">
        <li
          v-for="component in product.components"
          :key="component.id || component.name"
          class="flex items-center justify-between gap-3 text-sm"
        >
          <span class="text-muted">{{ component.name || component.id }}</span>
          <span class="font-medium tabular-nums text-highlighted">
            {{ component.quantity?.toLocaleString('es-MX') ?? '—' }}
          </span>
        </li>
      </ul>
    </div>

    <div v-if="product.description" class="mt-4 border-t border-default pt-4">
      <h4 class="text-sm font-medium text-highlighted">
        Descripción
      </h4>
      <p class="mt-2 whitespace-pre-wrap break-words text-sm text-muted">
        {{ product.description }}
      </p>
    </div>
  </section>
</template>
