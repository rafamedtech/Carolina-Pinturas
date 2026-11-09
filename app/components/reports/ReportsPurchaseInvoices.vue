<script setup lang="ts">
import type { ReportMetrics } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'
import { purchaseMoney } from '~/utils/purchaseFormat'

const props = defineProps<{ totals: ReportMetrics['purchaseInvoiceTotals'], annual?: boolean }>()

const visible = computed(() => {
  const active = props.totals.filter(total => total.amount !== 0 || total.previousAmount !== 0)
  return active.length ? active : props.totals.filter(total => total.currencyCode === 'MXN')
})
</script>

<template>
  <DetailCard class="min-w-0" :ui="{ container: 'min-w-0' }" icon="i-lucide-receipt-text">
    <template #title>
      <DetailSectionHeading
        title="Facturas de compras"
        :description="`Facturado por proveedores en el ${annual ? 'año' : 'mes'}, por moneda. Puede diferir de lo pagado.`"
        :ui="{ title: 'text-base' }"
      />
    </template>

    <DetailFields :fields="visible.map(total => ({ key: total.currencyCode, label: total.currencyCode }))" :columns="1">
      <template #value="{ field }">
        <template v-for="total in visible.filter(total => total.currencyCode === field.key)" :key="total.currencyCode">
          <p class="text-xl font-semibold tabular-nums text-highlighted">
            {{ purchaseMoney(total.amount, total.currencyCode) }}
          </p>
          <p class="mt-0.5 text-xs text-muted tabular-nums">
            {{ annual ? 'Año anterior' : 'Mes anterior' }} {{ purchaseMoney(total.previousAmount, total.currencyCode) }}
            <template v-if="total.changePercentage !== null">
              · {{ total.changePercentage > 0 ? '+' : '' }}{{ dashboardNumber.format(total.changePercentage) }}%
            </template>
          </p>
        </template>
      </template>
    </DetailFields>
  </DetailCard>
</template>
