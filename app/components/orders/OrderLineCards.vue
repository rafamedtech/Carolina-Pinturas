<script setup lang="ts">
import type { DraftOrderLine } from '~/composables/useOrderDraft'

defineProps<{
  lines: readonly DraftOrderLine[]
}>()

const emit = defineEmits<{
  remove: [productId: string]
  observations: [productId: string, value: string]
}>()

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
})

function lineTotal(line: DraftOrderLine) {
  const listedTotal = line.quantity * line.unitPrice
  return line.taxIncluded
    ? listedTotal
    : listedTotal * (1 + line.taxPercentage / 100)
}
</script>

<template>
  <div class="flex flex-col gap-3 p-4 md:hidden">
    <UCard
      v-for="line in lines"
      :key="line.productId"
      variant="subtle"
      :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-medium uppercase tracking-wide text-muted">
            {{ line.code }}
          </p>
          <h3 class="font-semibold text-highlighted">
            {{ line.name }}
          </h3>
        </div>

        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          :aria-label="`Quitar ${line.name}`"
          @click="emit('remove', line.productId)"
        />
      </div>

      <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt class="text-muted">
            Cantidad
          </dt>
          <dd class="font-medium text-highlighted">
            {{ line.quantity }}
          </dd>
        </div>
        <div class="text-right">
          <dt class="text-muted">
            Precio unitario
          </dt>
          <dd class="font-medium text-highlighted">
            {{ currency.format(line.unitPrice) }}
          </dd>
        </div>
        <div class="col-span-2 flex items-end justify-between gap-4 border-t border-default pt-3">
          <dt class="text-muted">
            Importe
          </dt>
          <dd class="text-base font-semibold text-highlighted">
            {{ currency.format(lineTotal(line)) }}
          </dd>
        </div>
      </dl>

      <UFormField label="Observaciones">
        <UInput
          :model-value="line.observations"
          placeholder="Observaciones…"
          variant="subtle"
          class="w-full"
          :aria-label="`Observaciones de ${line.name}`"
          @update:model-value="emit('observations', line.productId, $event)"
        />
      </UFormField>
    </UCard>

    <div
      v-if="lines.length === 0"
      class="flex flex-col items-center gap-2 rounded-lg border border-default bg-elevated/50 px-4 py-10 text-center"
    >
      <UIcon name="i-lucide-shopping-cart" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        Agrega productos para iniciar el pedido.
      </p>
    </div>
  </div>
</template>
