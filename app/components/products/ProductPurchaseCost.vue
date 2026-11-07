<script setup lang="ts">
import { purchaseMoney } from '~/utils/purchaseFormat'

const props = defineProps<{ productId: string }>()
const { data: cost, status, error } = useFetch<{ value: string | null, currency: string | null }>(
  () => `/api/products/${encodeURIComponent(props.productId)}/cost`,
  { lazy: true, server: false }
)
</script>

<template>
  <UPageCard title="Costo de compra" icon="i-lucide-receipt" variant="subtle">
    <USkeleton v-if="['idle', 'pending'].includes(status)" class="h-7 w-28" aria-label="Cargando costo de compra" />
    <p v-else-if="error" class="text-sm text-error">
      No se pudo cargar el costo de compra.
    </p>
    <div v-else-if="cost?.value != null && cost.currency">
      <p class="text-lg font-semibold text-highlighted tabular-nums">
        {{ purchaseMoney(Number(cost.value), cost.currency) }}
        <span class="text-sm font-normal text-muted">{{ cost.currency }}</span>
      </p>
      <p class="mt-1 text-sm text-muted">
        Costo unitario registrado a partir de la última recepción válida o del inventario inicial.
      </p>
    </div>
    <p v-else class="text-sm text-muted">
      Sin costo de compra registrado.
    </p>
  </UPageCard>
</template>
