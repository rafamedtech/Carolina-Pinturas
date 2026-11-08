<script setup lang="ts">
import type { SiigoProduct } from '~/types/siigo'
import { formatDateTime } from '~/utils/datetime'

const props = defineProps<{ product?: SiigoProduct | null, productId: string, loading?: boolean, showPurchaseCost: boolean }>()

const unit = computed(() => {
  const value = props.product?.unit
  return typeof value === 'string' ? { code: value, name: undefined } : value
})
const prices = computed(() => props.product?.prices?.flatMap(price =>
  (price.price_list || []).map(item => ({ ...item, currency: price.currency_code || 'MXN' }))
) || [])

const generalFields = computed(() => {
  const item = props.product
  return [
    { label: 'Creado', value: formatDateTime(item?.metadata?.created) },
    { label: 'Última actualización', value: formatDateTime(item?.metadata?.last_updated) },
    { label: 'Grupo', value: item?.account_group?.name },
    { label: 'Tipo', value: item?.internal?.composition?.kind === 'composite' ? 'Producto compuesto' : item?.type === 'Product' || !item?.type ? 'Producto' : item?.type },
    { label: 'Marca', value: item?.additional_fields?.brand },
    { label: 'Control de inventario', value: item?.internal?.composition?.kind === 'composite' ? 'Control por componentes' : item?.internal?.inventory?.tracked ? 'Controlado' : 'Sin control' }
  ]
})
const fiscalFields = computed(() => {
  const item = props.product
  return [
    { label: 'Clave SAT', fullWidth: true, value: joinParts(item?.key?.code, item?.key?.name) },
    { label: 'Unidad SAT', value: joinParts(unit.value?.code, unit.value?.name) },
    { label: 'Impuestos incluidos', value: item?.tax_included === undefined ? undefined : item?.tax_included ? 'Sí' : 'No' }
  ]
})

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
  <UPageGrid class="grid-cols-2 gap-4 lg:grid-cols-3">
    <div class="col-span-2 flex flex-col gap-4">
      <DetailCard v-if="product?.internal?.composition?.kind === 'composite'" title="Componentes por unidad">
        <ul class="divide-y divide-default">
          <li v-for="component in product?.internal.composition.components" :key="component.productId" class="flex items-center justify-between gap-3 py-3 text-sm">
            <ULink :to="`/productos/${component.productId}`" class="text-primary underline underline-offset-2">
              {{ component.code }} · {{ component.name ?? component.productId }}
            </ULink>
            <span class="shrink-0 font-medium tabular-nums">{{ component.quantity }} {{ component.unit }}</span>
          </li>
        </ul>
        <p class="mt-3 text-sm text-muted">
          Se reserva al confirmar el pedido y se descuenta al surtir. Este producto no tiene existencias propias.
        </p>
      </DetailCard>
      <DetailCard title="Información general" icon="i-lucide-info">
        <DetailFields :fields="generalFields" :loading="loading" />
      </DetailCard>

      <DetailCard v-if="product?.components?.length" title="Componentes">
        <ul class="space-y-3">
          <li v-for="component in product?.components" :key="component.id || component.name" class="flex items-center justify-between gap-3 text-sm">
            <span class="min-w-0">
              <span class="block">{{ component.name || component.id }}</span>
              <span v-if="component.name && component.id" class="block text-xs text-muted">ID {{ component.id }}</span>
            </span>
            <span class="font-medium">{{ formatQuantity(component.quantity) }}</span>
          </li>
        </ul>
      </DetailCard>
    </div>

    <div class="col-span-2 flex flex-col gap-4 lg:col-span-1">
      <DetailCard title="Datos fiscales" icon="i-lucide-file-check">
        <DetailFields :fields="fiscalFields" :loading="loading" />
      </DetailCard>
    </div>
    <DetailCard
      title="Listas de precios"
      icon="i-lucide-tags"
      class="lg:col-span-2"
      :class="{ 'col-span-2': !showPurchaseCost }"
    >
      <div
        v-if="loading"
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Cargando listas de precios"
        aria-busy="true"
      >
        <div v-for="index in 2" :key="index" class="space-y-2 border-t border-default pt-3">
          <USkeleton class="h-4 w-28" />
          <USkeleton class="h-7 w-24" />
        </div>
      </div>
      <div v-else-if="prices.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="price in prices" :key="`${price.currency}-${price.position}`" class="border-t border-default pt-3">
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
    </DetailCard>
    <ProductsProductPurchaseCost v-if="showPurchaseCost" :product-id="productId" />
  </UPageGrid>
</template>
