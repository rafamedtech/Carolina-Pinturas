<script setup lang="ts">
import type { ReportBreakdownItem } from '~/types/reports'
import { dashboardCompactCurrency } from '~/utils/dashboardFormatters'

const props = defineProps<{
  paymentMethods: ReportBreakdownItem[]
  expenseCategories: ReportBreakdownItem[]
}>()

const breakdowns = computed(() => [{
  key: 'payments',
  title: 'Cobros por método',
  description: 'Cómo entra el dinero al negocio.',
  icon: 'i-lucide-wallet-cards',
  accent: 'text-success bg-success/10',
  color: 'success' as const,
  items: props.paymentMethods,
  emptyIcon: 'i-lucide-hand-coins',
  emptyTitle: 'Sin cobros',
  countLabel: (count: number) => `${count} ${count === 1 ? 'movimiento' : 'movimientos'}`
}, {
  key: 'expenses',
  title: 'Gastos por categoría',
  description: 'En qué se concentraron los egresos.',
  icon: 'i-lucide-chart-pie',
  accent: 'text-warning bg-warning/10',
  color: 'warning' as const,
  items: props.expenseCategories,
  emptyIcon: 'i-lucide-receipt',
  emptyTitle: 'Sin gastos',
  countLabel: (count: number) => `${count} ${count === 1 ? 'gasto' : 'gastos'}`
}])
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-2">
    <UCard v-for="breakdown in breakdowns" :key="breakdown.key" :ui="{ header: 'pb-3', body: 'pt-4' }">
      <template #header>
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-highlighted">
              {{ breakdown.title }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ breakdown.description }}
            </p>
          </div>
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg" :class="breakdown.accent">
            <UIcon :name="breakdown.icon" class="size-4" />
          </span>
        </div>
      </template>

      <ul v-if="breakdown.items.length" class="divide-y divide-default">
        <li v-for="item in breakdown.items" :key="item.key" class="py-3 first:pt-0 last:pb-0">
          <div class="flex items-baseline justify-between gap-4">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ item.label }}
            </p>
            <p class="shrink-0 text-sm font-semibold tabular-nums text-highlighted">
              {{ dashboardCompactCurrency(item.amount) }}
            </p>
          </div>
          <UProgress
            :model-value="item.percentage"
            :color="breakdown.color"
            size="xs"
            class="mt-2"
          />
          <div class="mt-1.5 flex items-center justify-between gap-4 text-xs text-muted">
            <span>{{ breakdown.countLabel(item.count) }}</span>
            <span class="tabular-nums">{{ item.percentage }}%</span>
          </div>
        </li>
      </ul>

      <UEmpty
        v-else
        :icon="breakdown.emptyIcon"
        :title="breakdown.emptyTitle"
        class="py-12"
      />
    </UCard>
  </div>
</template>
