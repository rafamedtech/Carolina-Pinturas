<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'

const props = defineProps<{
  product: SiigoProduct
}>()

const { data: fetchedProduct, error } = useLazyFetch<SiigoProduct>(
  () => `/api/siigo/products/${encodeURIComponent(props.product.id)}`,
  { key: `order-product-detail-${props.product.id}` }
)

const product = computed(() => fetchedProduct.value ?? props.product)
const salePrice = computed(() => {
  const price = product.value.prices?.find(item =>
    item.currency_code === 'MXN'
    && item.price_list?.some(entry => entry.position === 1)
  ) ?? product.value.prices?.find(item =>
    item.price_list?.some(entry => entry.position === 1)
  )
  const value = price?.price_list?.find(item => item.position === 1)?.value

  return formatCurrency(value, price?.currency_code || 'MXN')
})
const details = computed(() => [
  {
    label: 'Unidad',
    value: siigoProductUnit(product.value) || '—'
  },
  { label: 'Tipo', value: product.value.type || '—' },
  { label: 'Marca', value: product.value.additional_fields?.brand || '—' },
  {
    label: 'Grupo contable',
    value: product.value.account_group?.name || '—'
  }
])
const detailOpen = ref(false)
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
</script>

<template>
  <section class="rounded-xl border border-default bg-elevated/40 p-4">
    <div class="min-w-0">
      <p class="text-xs font-medium uppercase tracking-wide text-muted">
        Detalle del producto
      </p>
      <button
        type="button"
        class="mt-1 inline-flex items-center gap-1.5 break-words text-left font-semibold text-highlighted hover:text-primary"
        @click="detailOpen = true"
      >
        {{ product.name }}
        <UIcon name="i-lucide-info" class="size-4 shrink-0 text-muted" />
      </button>
      <p class="mt-0.5 text-sm text-muted">
        Código: {{ product.code || '—' }}
      </p>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-lg bg-primary/10 p-3">
        <p class="text-xs font-medium text-primary">
          Existencia disponible
        </p>
        <p class="mt-1 text-lg font-semibold tabular-nums text-highlighted">
          {{ availability }}
        </p>
      </div>

      <div class="rounded-lg bg-primary/10 p-3">
        <p class="text-xs font-medium text-primary">
          Precio de venta
        </p>
        <p class="mt-1 text-lg font-semibold tabular-nums text-highlighted">
          {{ salePrice }}
        </p>
      </div>
    </div>

    <p v-if="error" class="mt-3 text-xs text-warning">
      No fue posible actualizar el detalle; se muestran los datos del catálogo.
    </p>

    <UModal
      v-model:open="detailOpen"
      :title="product.name"
      :description="`Código: ${product.code || '—'}`"
    >
      <template #body>
        <dl class="grid gap-x-5 gap-y-3 sm:grid-cols-2">
          <div v-for="detail in details" :key="detail.label" class="min-w-0">
            <dt class="text-xs text-muted">
              {{ detail.label }}
            </dt>
            <dd class="mt-0.5 break-words text-sm font-medium text-highlighted">
              {{ detail.value }}
            </dd>
          </div>
        </dl>

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
      </template>
    </UModal>
  </section>
</template>
