<script setup lang="ts">
import type { ReportRankingItem } from '~/types/reports'
import { dashboardCompactCurrency, dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{
  customers: ReportRankingItem[]
  products: ReportRankingItem[]
  sellers: ReportRankingItem[]
}>()

const rankings = computed(() => [{
  key: 'customers',
  title: 'Clientes principales',
  description: 'Concentración de ventas por cliente.',
  icon: 'i-lucide-users',
  empty: 'Sin clientes con ventas',
  items: props.customers,
  countLabel: (count: number) => `${count} ${count === 1 ? 'pedido' : 'pedidos'}`
}, {
  key: 'products',
  title: 'Productos destacados',
  description: 'Productos con mayor venta del periodo.',
  icon: 'i-lucide-package-open',
  empty: 'Sin productos vendidos',
  items: props.products,
  countLabel: (count: number) => `${dashboardNumber.format(count)} uds.`
}, {
  key: 'sellers',
  title: 'Desempeño comercial',
  description: 'Ventas registradas por vendedor.',
  icon: 'i-lucide-medal',
  empty: 'Sin actividad comercial',
  items: props.sellers,
  countLabel: (count: number) => `${count} ${count === 1 ? 'pedido' : 'pedidos'}`
}])
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-3">
    <UCard v-for="ranking in rankings" :key="ranking.key" :ui="{ header: 'pb-3', body: 'pt-4' }">
      <template #header>
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-highlighted">
              {{ ranking.title }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ ranking.description }}
            </p>
          </div>
          <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon :name="ranking.icon" class="size-4" />
          </span>
        </div>
      </template>

      <ol v-if="ranking.items.length" class="divide-y divide-default">
        <li v-for="(item, index) in ranking.items" :key="item.id" class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
            :class="index === 0 ? 'bg-primary/10 text-primary' : 'bg-elevated text-muted'"
          >
            {{ index + 1 }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-3">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ item.label }}
              </p>
              <p class="shrink-0 text-sm font-semibold tabular-nums text-highlighted">
                {{ dashboardCompactCurrency(item.amount) }}
              </p>
            </div>
            <UProgress
              :model-value="item.percentage"
              color="primary"
              size="xs"
              class="mt-2"
            />
            <p class="mt-1.5 truncate text-xs text-muted">
              {{ item.detail }} · {{ ranking.countLabel(item.count) }}
            </p>
          </div>
        </li>
      </ol>

      <UEmpty
        v-else
        :icon="ranking.icon"
        :title="ranking.empty"
        class="py-12"
      />
    </UCard>
  </div>
</template>
