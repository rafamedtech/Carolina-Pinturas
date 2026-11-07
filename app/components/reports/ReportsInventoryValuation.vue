<script setup lang="ts">
import type { ReportInventoryValuation } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'
import { purchaseMoney } from '~/utils/purchaseFormat'

const props = defineProps<{ valuation: ReportInventoryValuation }>()

const missingCostLabel = computed(() => {
  const count = props.valuation.productsWithoutCost
  if (count === 1) return '1 producto con existencias queda fuera del cálculo por falta de costo registrado.'
  return `${dashboardNumber.format(count)} productos con existencias quedan fuera del cálculo por falta de costo registrado.`
})
</script>

<template>
  <UCard>
    <h2 class="text-base font-semibold text-highlighted">
      Valor actual de la mercancía
    </h2>
    <p class="mt-1 text-sm text-muted">
      Existencias físicas de todos los almacenes, incluidas las reservas, al último costo unitario registrado.
    </p>
    <dl v-if="valuation.totals.length" class="mt-4 flex flex-wrap gap-x-8 gap-y-3">
      <div v-for="total in valuation.totals" :key="total.currencyCode">
        <dt class="text-xs font-medium text-muted">
          {{ total.currencyCode }}
        </dt>
        <dd class="text-xl font-semibold tabular-nums text-highlighted">
          {{ purchaseMoney(total.amount, total.currencyCode) }}
        </dd>
      </div>
    </dl>
    <p v-else class="mt-4 text-sm text-muted">
      {{ valuation.productsWithoutCost ? 'Sin existencias con costo registrado.' : 'Sin existencias.' }}
    </p>
    <p v-if="valuation.productsWithoutCost" class="mt-3 text-sm text-muted">
      {{ missingCostLabel }}
    </p>
  </UCard>
</template>
