<script setup lang="ts">
import Decimal from 'decimal.js'

const props = defineProps<{ subtotal: number, units: number, currencyCode: 'MXN' | 'USD', busy: boolean }>()
// El IVA es una ayuda local: nunca forma parte del borrador guardado.
const vatRate = shallowRef(0)
const vatOptions = [
  { label: '8%', value: 8 },
  { label: '16%', value: 16 },
  { label: '0%', value: 0 }
]
const money = computed(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: props.currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const vat = computed(() => new Decimal(props.subtotal).mul(vatRate.value ?? 0).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP))
const total = computed(() => new Decimal(props.subtotal).plus(vat.value).toNumber())
</script>

<template>
  <div class="flex flex-col gap-3 sm:ms-auto sm:max-w-sm">
    <UFormField
      label="IVA del proveedor (%)"
      orientation="horizontal"
      :ui="{ root: 'items-center', labelWrapper: 'justify-start gap-1', container: 'w-28 shrink-0' }"
    >
      <template #hint>
        <UTooltip
          text="Solo para calcular el total en pantalla. No se guarda en la compra."
          :ui="{ content: 'h-auto max-w-64', text: 'whitespace-normal' }"
        >
          <UButton
            icon="i-lucide-info"
            aria-label="Información sobre el IVA del proveedor"
            color="neutral"
            variant="ghost"
            size="xs"
          />
        </UTooltip>
      </template>
      <USelectMenu
        v-model="vatRate"
        :items="vatOptions"
        value-key="value"
        :search-input="false"
        :disabled="busy"
        class="w-full"
      />
    </UFormField>
    <div class="flex items-center justify-between gap-4 text-sm">
      <span class="text-muted">Unidades</span>
      <span class="tabular-nums">{{ units.toLocaleString('es-MX', { maximumFractionDigits: 6 }) }}</span>
    </div>
    <div class="flex items-center justify-between gap-4 text-sm">
      <span class="text-muted">Subtotal antes de impuestos</span>
      <span class="tabular-nums">{{ money.format(subtotal) }}</span>
    </div>
    <div class="flex items-center justify-between gap-4 text-sm">
      <span class="text-muted">IVA ({{ vatRate ?? 0 }}%)</span>
      <span class="tabular-nums">{{ money.format(vat.toNumber()) }}</span>
    </div>
    <div class="flex items-center justify-between gap-4 border-t border-default pt-2">
      <span class="font-semibold text-primary">Total con IVA ({{ currencyCode }})</span>
      <span class="text-lg font-semibold text-primary tabular-nums">{{ money.format(total) }}</span>
    </div>
  </div>
</template>
