<script setup lang="ts">
import type { DraftOrderLine } from '~/composables/useOrderDraft'
import { draftLineTotal } from '~/composables/useOrderDraft'
import type { OrderDiscountType } from '~/types/orders'
import { DISCOUNT_TYPE_OPTIONS } from '~/utils/orderDiscount'

defineProps<{
  lines: readonly DraftOrderLine[]
  quoteMode?: boolean
  editablePrices?: boolean
}>()

const emit = defineEmits<{
  'remove': [productId: string]
  'observations': [productId: string, value: string]
  'quantity': [productId: string, value: number]
  'discount': [productId: string, type: OrderDiscountType, value: number]
  'edit-price': [line: DraftOrderLine]
}>()

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
})
</script>

<template>
  <div class="flex flex-col gap-3 p-4 md:hidden">
    <ListRecordCard
      v-for="line in lines"
      :key="line.productId"
      :title="line.name"
      :eyebrow="line.code"
      summary-label="Importe"
      :summary-value="currency.format(draftLineTotal(line))"
    >
      <template #title-extra>
        <p class="text-sm text-muted">
          Unidad: {{ line.unit.name || line.unit.code || '—' }}
        </p>
      </template>
      <template #actions>
        <AppButton
          icon="i-lucide-trash-2"
          color="error"
          intent="quiet"
          size="sm"
          :aria-label="`Quitar ${line.name}`"
          @click="emit('remove', line.productId)"
        />
      </template>

      <div class="grid grid-cols-2 items-end gap-4">
        <UFormField label="Cantidad">
          <UInputNumber
            :model-value="line.quantity"
            :min="0.01"
            :step="1"
            :step-snapping="false"
            :format-options="{ maximumFractionDigits: 2 }"
            variant="subtle"
            class="w-full"
            :aria-label="`Cantidad de ${line.name}`"
            @update:model-value="emit('quantity', line.productId, $event)"
          />
        </UFormField>

        <dl class="text-right text-sm">
          <div>
            <dt class="text-muted">
              Precio unitario
            </dt>
            <dd class="flex items-center justify-end gap-1 font-medium text-highlighted">
              {{ currency.format(line.unitPrice) }}
              <UButton
                v-if="editablePrices"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="`Editar precio de ${line.name}`"
                @click="emit('edit-price', line)"
              />
            </dd>
          </div>
        </dl>
      </div>

      <UFormField label="Descuento">
        <div class="flex items-center gap-2">
          <USelect
            :model-value="line.discountType"
            :items="DISCOUNT_TYPE_OPTIONS"
            variant="subtle"
            class="w-20"
            :aria-label="`Tipo de descuento de ${line.name}`"
            @update:model-value="emit('discount', line.productId, $event as OrderDiscountType, line.discountValue)"
          />
          <UInputNumber
            :model-value="line.discountValue"
            :min="0"
            :max="line.discountType === 'porcentaje' ? 100 : undefined"
            :step="1"
            variant="subtle"
            class="w-full"
            :aria-label="`Descuento de ${line.name}`"
            @update:model-value="emit('discount', line.productId, line.discountType, $event)"
          />
        </div>
      </UFormField>

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
    </ListRecordCard>

    <div
      v-if="lines.length === 0"
      class="flex flex-col items-center gap-2 rounded-lg border border-default bg-elevated/50 px-4 py-10 text-center"
    >
      <UIcon name="i-lucide-shopping-cart" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        Agrega productos para iniciar {{ quoteMode ? 'la cotización' : 'el pedido' }}.
      </p>
    </div>
  </div>
</template>
