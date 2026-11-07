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
    <h3 class="mt-4 text-sm font-semibold text-highlighted">
      Total general
    </h3>
    <dl v-if="valuation.totals.length" class="mt-2 flex flex-wrap gap-x-8 gap-y-3">
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
    <div v-if="valuation.warehouses.length" class="mt-5 overflow-x-auto">
      <table class="w-full text-sm">
        <caption class="pb-2 text-left font-semibold text-highlighted">
          Detalle por almacén
        </caption>
        <thead class="border-b border-default text-muted">
          <tr>
            <th scope="col" class="py-2 pr-4 text-left font-medium">
              Almacén
            </th>
            <th scope="col" class="py-2 pr-4 text-right font-medium">
              Valor de la mercancía
            </th>
            <th scope="col" class="py-2 text-right font-medium">
              Productos sin costo
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="warehouse in valuation.warehouses" :key="warehouse.id">
            <th scope="row" class="py-2 pr-4 text-left font-medium text-highlighted">
              {{ warehouse.name }}
              <span class="block text-xs font-normal text-muted">{{ warehouse.code }}</span>
            </th>
            <td class="py-2 pr-4 text-right tabular-nums">
              <template v-if="warehouse.totals.length">
                <div v-for="total in warehouse.totals" :key="total.currencyCode" class="whitespace-nowrap">
                  {{ purchaseMoney(total.amount, total.currencyCode) }}
                  <span v-if="total.currencyCode === 'MXN'" class="text-muted">MXN</span>
                </div>
              </template>
              <span v-else class="text-muted">
                {{ warehouse.productsWithoutCost ? 'Sin costo registrado' : 'Sin existencias' }}
              </span>
            </td>
            <td class="py-2 text-right tabular-nums">
              {{ dashboardNumber.format(warehouse.productsWithoutCost) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
