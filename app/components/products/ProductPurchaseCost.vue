<script setup lang="ts">
import { purchaseMoney } from '~/utils/purchaseFormat'

const props = defineProps<{ productId: string }>()
const canHover = useMediaQuery('(hover: hover) and (pointer: fine)')
const { data: cost, status, error } = useFetch<{ value: string | null, currency: string | null }>(
  () => `/api/products/${encodeURIComponent(props.productId)}/cost`,
  { lazy: true, server: false }
)
</script>

<template>
  <DetailCard icon="i-lucide-receipt" variant="subtle">
    <template #title>
      <div class="flex items-center gap-1">
        <span>Costo de compra</span>
        <UPopover :mode="canHover ? 'hover' : 'click'" :content="{ side: 'top' }" arrow>
          <AppButton
            icon="i-lucide-info"
            intent="quiet"
            size="xs"
            aria-label="Información del costo de compra"
            class="size-6 shrink-0 justify-center p-0"
            :ui="{ leadingIcon: 'size-3.5' }"
          />
          <template #content>
            <p class="max-w-64 p-3 text-sm text-default">
              Costo unitario registrado a partir de la última recepción válida o del inventario inicial.
            </p>
          </template>
        </UPopover>
      </div>
    </template>
    <USkeleton v-if="['idle', 'pending'].includes(status)" class="h-7 w-28" aria-label="Cargando costo de compra" />
    <p v-else-if="error" class="text-sm text-error">
      No se pudo cargar el costo de compra.
    </p>
    <div v-else-if="cost?.value != null && cost.currency" class="inline-flex w-fit items-center gap-1">
      <p class="text-lg font-semibold text-highlighted tabular-nums">
        {{ purchaseMoney(Number(cost.value), cost.currency) }}
        <span class="text-sm font-normal text-muted">{{ cost.currency }}</span>
      </p>
    </div>
    <p v-else class="text-sm text-muted">
      Sin costo de compra registrado.
    </p>
  </DetailCard>
</template>
