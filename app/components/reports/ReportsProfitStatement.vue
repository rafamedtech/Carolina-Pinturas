<script setup lang="ts">
import { reportCurrency } from '~/utils/reportPeriods'
import type { ReportMetrics } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ metrics: ReportMetrics }>()

interface StatementRow {
  key: string
  label: string
  sign: '' | '−' | '='
  amount: number
  previous: number
  bar: string
  total?: boolean
  // Costs grow in the wrong direction, so their variation reads inverted.
  inverse?: boolean
}

const rows = computed<StatementRow[]>(() => {
  const m = props.metrics
  return [
    { key: 'sales', label: 'Ventas netas', sign: '', amount: m.sales, previous: m.previousSales, bar: 'bg-primary' },
    { key: 'materials', label: 'Compras de material', sign: '−', amount: m.materialPurchases, previous: m.previousMaterialPurchases, bar: 'bg-violet-500', inverse: true },
    { key: 'gross', label: 'Utilidad bruta', sign: '=', amount: m.grossProfit, previous: m.previousGrossProfit, bar: 'bg-success/60', total: true },
    { key: 'operating', label: 'Gastos operativos', sign: '−', amount: m.operatingExpenses, previous: m.previousOperatingExpenses, bar: 'bg-warning', inverse: true },
    { key: 'net', label: 'Utilidad neta', sign: '=', amount: m.netProfit, previous: m.previousNetProfit, bar: m.netProfit < 0 ? 'bg-error' : 'bg-success', total: true }
  ]
})

const scale = computed(() => Math.max(props.metrics.sales, props.metrics.materialPurchases + props.metrics.operatingExpenses, 1))

function width(amount: number) {
  return `${Math.min(Math.abs(amount) / scale.value * 100, 100)}%`
}

function share(amount: number) {
  return props.metrics.sales > 0 ? `${dashboardNumber.format(Math.round(amount / props.metrics.sales * 1000) / 10)}%` : '—'
}

function change(row: StatementRow) {
  if (!row.previous) return { label: 'Sin base', class: 'text-muted' }
  const value = Math.round((row.amount - row.previous) / Math.abs(row.previous) * 1000) / 10
  const favorable = row.inverse ? value <= 0 : value >= 0
  return {
    label: `${value > 0 ? '+' : ''}${dashboardNumber.format(value)}%`,
    class: favorable ? 'text-success' : 'text-error'
  }
}

// Split each $100 sold between material, operating cost and what is left.
const hundred = computed(() => {
  const m = props.metrics
  if (m.sales <= 0) return null
  const material = m.materialPurchases / m.sales * 100
  const operating = m.operatingExpenses / m.sales * 100
  return [
    { key: 'materials', label: 'Material', value: material, class: 'bg-violet-500' },
    { key: 'operating', label: 'Operación', value: operating, class: 'bg-warning' },
    { key: 'profit', label: m.netProfit < 0 ? 'Pérdida' : 'Te queda', value: 100 - material - operating, class: m.netProfit < 0 ? 'bg-error' : 'bg-success' }
  ]
})
const hundredTotal = computed(() => hundred.value?.reduce((sum, item) => sum + Math.abs(item.value), 0) ?? 0)
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            Estado de resultados
          </h2>
          <p class="mt-1 text-sm text-pretty text-muted">
            De la venta neta a la utilidad, con la variación contra el mes anterior.
          </p>
        </div>
        <p class="text-xs text-muted tabular-nums">
          Margen bruto
          <span class="font-semibold text-highlighted">
            {{ metrics.grossMarginPercentage === null ? '—' : `${dashboardNumber.format(metrics.grossMarginPercentage)}%` }}
          </span>
        </p>
      </div>
    </template>

    <table class="w-full text-sm">
      <caption class="sr-only">
        Estado de resultados del mes en pesos mexicanos, antes de IVA
      </caption>
      <thead class="sr-only">
        <tr>
          <th>Concepto</th><th>Importe</th><th>Porcentaje de la venta</th><th>Variación</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.key"
          :class="row.total ? 'bg-elevated/50' : ''"
          class="border-t border-default first:border-t-0"
        >
          <th scope="row" class="w-[42%] py-3 pr-3 pl-4 text-left font-normal sm:pl-6">
            <div class="flex items-center gap-2">
              <span class="w-3 shrink-0 text-center font-mono text-xs text-dimmed" aria-hidden="true">{{ row.sign }}</span>
              <span :class="row.total ? 'font-semibold text-highlighted' : 'text-default'">{{ row.label }}</span>
            </div>
            <div class="mt-2 ml-5 h-1.5 rounded-full bg-elevated">
              <div class="h-full rounded-full transition-[width] duration-500" :class="row.bar" :style="{ width: width(row.amount) }" />
            </div>
          </th>
          <td class="py-3 pr-3 text-right whitespace-nowrap tabular-nums" :class="row.total ? 'font-semibold text-highlighted' : 'font-medium text-default'">
            <span :class="row.amount < 0 ? 'text-error' : ''">{{ reportCurrency.format(row.amount) }}</span>
            <p class="mt-0.5 text-xs font-normal text-muted">
              ant. {{ reportCurrency.format(row.previous) }}
            </p>
          </td>
          <td class="hidden py-3 pr-3 text-right text-xs whitespace-nowrap text-muted tabular-nums sm:table-cell">
            {{ share(row.amount) }}
          </td>
          <td class="py-3 pr-4 text-right text-xs font-medium whitespace-nowrap tabular-nums sm:pr-6" :class="change(row).class">
            {{ change(row).label }}
          </td>
        </tr>
      </tbody>
    </table>

    <template v-if="hundred" #footer>
      <p class="text-xs font-medium text-muted">
        De cada $100 vendidos
      </p>
      <div
        class="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full"
        role="img"
        :aria-label="hundred.map(item => `${item.label}: $${dashboardNumber.format(item.value)}`).join(', ')"
      >
        <div
          v-for="item in hundred"
          :key="item.key"
          :class="item.class"
          :style="{ width: `${Math.abs(item.value) / hundredTotal * 100}%` }"
        />
      </div>
      <dl class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <div v-for="item in hundred" :key="item.key" class="flex items-center gap-1.5">
          <span class="size-2 rounded-full" :class="item.class" />
          <dt class="text-muted">
            {{ item.label }}
          </dt>
          <dd class="font-semibold tabular-nums text-highlighted">
            ${{ dashboardNumber.format(Math.round(item.value * 10) / 10) }}
          </dd>
        </div>
      </dl>
    </template>
  </UCard>
</template>
