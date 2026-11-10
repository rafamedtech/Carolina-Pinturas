<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { reportCurrency } from '~/utils/reportPeriods'
import type { ReportMetrics } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ metrics: ReportMetrics, annual?: boolean }>()

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

const columns: TableColumn<StatementRow>[] = [
  { accessorKey: 'label', header: 'Concepto' },
  { accessorKey: 'amount', header: 'Importe', meta: { class: { td: 'text-right whitespace-nowrap tabular-nums' } } },
  { id: 'share', header: 'Porcentaje de la venta', meta: { class: { th: 'hidden sm:table-cell', td: 'hidden text-right text-xs text-muted tabular-nums sm:table-cell' } } },
  { id: 'change', header: 'Variación', meta: { class: { td: 'text-right text-xs whitespace-nowrap tabular-nums' } } }
]

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
  <DetailCard class="min-w-0" :ui="{ container: 'min-w-0' }">
    <div class="space-y-3">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <DetailSectionHeading title="Estado de resultados" :ui="{ title: 'text-base' }" />
          <p class="mt-1 text-sm text-pretty text-muted">
            De la venta neta a la utilidad, con la variación contra el {{ annual ? 'año' : 'mes' }} anterior.
          </p>
        </div>
        <p class="text-xs text-muted tabular-nums">
          Margen bruto
          <span class="font-semibold text-highlighted">
            {{ metrics.grossMarginPercentage === null ? '—' : `${dashboardNumber.format(metrics.grossMarginPercentage)}%` }}
          </span>
        </p>
      </div>
    </div>

    <DetailTable
      :data="rows"
      :columns="columns"
      :get-row-id="row => row.key"
      :caption="`Estado de resultados del ${annual ? 'año' : 'mes'} en pesos mexicanos, antes de IVA`"
      :ui="{ thead: 'sr-only', caption: 'sr-only', td: 'align-top py-3' }"
    >
      <template #label-cell="{ row }">
        <div class="min-w-32" :class="row.original.total ? 'font-semibold text-highlighted' : 'text-default'">
          <div class="flex items-center gap-2">
            <span class="w-3 shrink-0 text-center font-mono text-xs text-dimmed" aria-hidden="true">{{ row.original.sign }}</span>
            <span>{{ row.original.label }}</span>
          </div>
          <div class="mt-2 ml-5 h-1.5 rounded-full bg-elevated">
            <div class="h-full rounded-full transition-[width] duration-500" :class="row.original.bar" :style="{ width: width(row.original.amount) }" />
          </div>
        </div>
      </template>
      <template #amount-cell="{ row }">
        <span :class="[row.original.total ? 'font-semibold' : 'font-medium', row.original.amount < 0 ? 'text-error' : row.original.total && row.original.amount > 0 ? 'text-success' : 'text-highlighted']">{{ reportCurrency.format(row.original.amount) }}</span>
        <p class="mt-0.5 text-xs font-normal text-muted">
          ant. {{ reportCurrency.format(row.original.previous) }}
        </p>
      </template>
      <template #share-cell="{ row }">
        {{ share(row.original.amount) }}
      </template>
      <template #change-cell="{ row }">
        <span :class="change(row.original).class">{{ change(row.original).label }}</span>
      </template>
    </DetailTable>

    <div v-if="hundred" class="border-t border-default pt-4">
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
      <DetailFields :fields="hundred.map(item => ({ key: item.key, label: item.label, value: `$${dashboardNumber.format(Math.round(item.value * 10) / 10)}` }))" :columns="3" class="mt-2">
        <template #label="{ field }">
          <span class="flex items-center gap-1.5 text-xs">
            <span class="size-2 rounded-full" :class="hundred.find(item => item.key === field.key)?.class" />
            {{ field.label }}
          </span>
        </template>
        <template #value="{ field }">
          <span class="text-xs font-semibold tabular-nums text-highlighted">{{ field.value }}</span>
        </template>
      </DetailFields>
    </div>
  </DetailCard>
</template>
