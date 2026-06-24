<script setup lang="ts">
import type { CatalogPrice } from '~/types/catalog'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  product: CatalogPrice | null
}>()

const details = computed(() => {
  if (!props.product) return []

  const availability = props.product.stockControl
    ? props.product.availableQuantity === undefined
      ? 'No disponible'
      : `${props.product.availableQuantity.toLocaleString('es-MX')} unidades`
    : 'Sin control de inventario'

  return [
    { label: 'Código', value: props.product.code || 'Sin código' },
    { label: 'Referencia', value: props.product.reference || 'No especificada' },
    { label: 'Tipo', value: props.product.type || 'Producto' },
    { label: 'Disponibilidad', value: availability }
  ]
})

const formattedPrice = computed(() => {
  if (props.product?.price === null || !props.product) return 'Consultar'

  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: props.product.currency
  }).format(props.product.price)
})
</script>

<template>
  <UModal
    v-if="product"
    v-model:open="open"
    :title="product.name"
    description="Detalle del producto"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <div class="space-y-6">
        <div class="rounded-xl bg-primary/10 p-4">
          <p class="text-sm font-medium text-primary">
            Precio de referencia
          </p>
          <p class="mt-1 text-3xl font-bold tabular-nums text-highlighted">
            {{ formattedPrice }}
          </p>
        </div>

        <dl class="divide-y divide-default rounded-xl border border-default">
          <div v-for="detail in details" :key="detail.label" class="px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <dt class="text-sm text-muted">
              {{ detail.label }}
            </dt>
            <dd class="mt-1 break-words text-sm font-medium text-highlighted sm:mt-0 sm:text-right">
              {{ detail.value }}
            </dd>
          </div>
        </dl>
      </div>
    </template>
  </UModal>
</template>
