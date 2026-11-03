<script setup lang="ts">
import type { ReportMetrics } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'
import { purchaseMoney } from '~/utils/purchaseFormat'

const props = defineProps<{ totals: ReportMetrics['purchaseInvoiceTotals'] }>()

const visible = computed(() => {
  const active = props.totals.filter(total => total.amount !== 0 || total.previousAmount !== 0)
  return active.length ? active : props.totals.filter(total => total.currencyCode === 'MXN')
})
</script>

<template>
  <UCard :ui="{ header: 'pb-3', body: 'pt-4' }">
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            Facturas de compras
          </h2>
          <p class="mt-1 text-sm text-muted">
            Facturado por proveedores en el mes, por moneda. Puede diferir de lo pagado.
          </p>
        </div>
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
          <UIcon name="i-lucide-receipt-text" class="size-4" />
        </span>
      </div>
    </template>

    <dl class="divide-y divide-default">
      <div v-for="total in visible" :key="total.currencyCode" class="py-3 first:pt-0 last:pb-0">
        <dt class="text-xs font-medium tracking-wide text-muted uppercase">
          {{ total.currencyCode }}
        </dt>
        <dd class="mt-1">
          <p class="text-xl font-semibold tabular-nums text-highlighted">
            {{ purchaseMoney(total.amount, total.currencyCode) }}
          </p>
          <p class="mt-0.5 text-xs text-muted tabular-nums">
            Ant. {{ purchaseMoney(total.previousAmount, total.currencyCode) }}
            <template v-if="total.changePercentage !== null">
              · {{ total.changePercentage > 0 ? '+' : '' }}{{ dashboardNumber.format(total.changePercentage) }}%
            </template>
          </p>
        </dd>
      </div>
    </dl>
  </UCard>
</template>
