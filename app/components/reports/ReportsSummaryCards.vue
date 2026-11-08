<script setup lang="ts">
import { reportCurrency } from '~/utils/reportPeriods'
import type { ReportMetrics } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{
  annual?: boolean
  metrics: ReportMetrics
}>()

type Tone = 'success' | 'error' | 'neutral'

function comparison(value: number | null, inverse = false): { label: string, tone: Tone, icon: string } {
  if (value === null) return { label: 'Sin base', tone: 'neutral', icon: 'i-lucide-minus' }
  const isFavorable = inverse ? value <= 0 : value >= 0
  return {
    label: `${value > 0 ? '+' : ''}${dashboardNumber.format(value)}%`,
    tone: isFavorable ? 'success' : 'error',
    icon: value >= 0 ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'
  }
}

function marginPoints(current: number | null, previous: number | null) {
  if (current === null || previous === null) return comparison(null)
  const points = Math.round((current - previous) * 10) / 10
  return {
    label: `${points > 0 ? '+' : ''}${dashboardNumber.format(points)} pts`,
    tone: points >= 0 ? 'success' as const : 'error' as const,
    icon: points >= 0 ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'
  }
}

function shareOfSales(amount: number) {
  const sales = props.metrics.sales
  return sales > 0 ? `${dashboardNumber.format(Math.round(amount / sales * 1000) / 10)}% de la venta` : `Sin ventas en el ${props.annual ? 'año' : 'mes'}`
}

const toneClasses: Record<Tone, string> = {
  success: 'text-success',
  error: 'text-error',
  neutral: 'text-muted'
}

const cards = computed(() => {
  const m = props.metrics
  return [{
    key: 'sales',
    title: 'Ventas netas',
    value: reportCurrency.format(m.sales),
    previous: reportCurrency.format(m.previousSales),
    marker: 'bg-primary',
    comparison: comparison(m.salesChangePercentage),
    detail: `${dashboardNumber.format(m.orderCount)} ${m.orderCount === 1 ? 'venta' : 'ventas'} · ticket ${reportCurrency.format(m.averageTicket)}`
  }, {
    key: 'materials',
    title: 'Compras de material',
    value: reportCurrency.format(m.materialPurchases),
    previous: reportCurrency.format(m.previousMaterialPurchases),
    marker: 'bg-violet-500',
    comparison: comparison(m.materialPurchasesChangePercentage, true),
    detail: shareOfSales(m.materialPurchases)
  }, {
    key: 'operating',
    title: 'Gastos operativos',
    value: reportCurrency.format(m.operatingExpenses),
    previous: reportCurrency.format(m.previousOperatingExpenses),
    marker: 'bg-warning',
    comparison: comparison(m.operatingExpensesChangePercentage, true),
    detail: shareOfSales(m.operatingExpenses)
  }]
})

const margin = computed(() => {
  const m = props.metrics
  return {
    percentage: m.netMarginPercentage === null ? '—' : `${dashboardNumber.format(m.netMarginPercentage)}%`,
    previous: m.previousNetMarginPercentage === null ? 'sin base' : `${dashboardNumber.format(m.previousNetMarginPercentage)}%`,
    comparison: marginPoints(m.netMarginPercentage, m.previousNetMarginPercentage),
    isLoss: m.netProfit < 0
  }
})
</script>

<template>
  <div class="grid gap-px overflow-hidden rounded-xl bg-(--ui-border) ring ring-default sm:grid-cols-2 xl:grid-cols-4">
    <article
      v-for="card in cards"
      :key="card.key"
      class="flex flex-col bg-default p-5"
    >
      <h3 class="flex items-center gap-2 text-sm font-medium text-muted">
        <span class="h-3.5 w-1 rounded-full" :class="card.marker" />
        {{ card.title }}
      </h3>

      <p class="mt-3 text-[1.65rem] leading-none font-semibold tracking-tight tabular-nums text-highlighted">
        {{ card.value }}
      </p>

      <p class="mt-3 flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums">
        <span class="inline-flex items-center gap-0.5 font-medium" :class="toneClasses[card.comparison.tone]">
          <UIcon :name="card.comparison.icon" class="size-3.5" />
          {{ card.comparison.label }}
        </span>
        <span class="text-muted">vs. {{ card.previous }} del {{ annual ? 'año' : 'mes' }} anterior</span>
      </p>

      <p class="mt-auto pt-4 text-xs text-muted tabular-nums">
        {{ card.detail }}
      </p>
    </article>

    <article class="flex flex-col p-5" :class="margin.isLoss ? 'bg-error/5' : 'bg-success/5'">
      <h3 class="flex items-center gap-2 text-sm font-medium text-muted">
        <span class="h-3.5 w-1 rounded-full" :class="margin.isLoss ? 'bg-error' : 'bg-success'" />
        Margen de ganancia
      </h3>

      <p class="mt-3 flex items-baseline gap-2">
        <span class="text-[1.65rem] leading-none font-semibold tracking-tight tabular-nums" :class="margin.isLoss ? 'text-error' : 'text-highlighted'">
          {{ margin.percentage }}
        </span>
        <span class="text-sm font-medium tabular-nums text-muted">
          {{ reportCurrency.format(metrics.netProfit) }}
        </span>
      </p>

      <p class="mt-3 flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums">
        <span class="inline-flex items-center gap-0.5 font-medium" :class="toneClasses[margin.comparison.tone]">
          <UIcon :name="margin.comparison.icon" class="size-3.5" />
          {{ margin.comparison.label }}
        </span>
        <span class="text-muted">vs. {{ margin.previous }} del {{ annual ? 'año' : 'mes' }} anterior</span>
      </p>

      <p class="mt-auto pt-4 text-xs text-muted">
        Utilidad neta sobre ventas
      </p>
    </article>
  </div>
</template>
