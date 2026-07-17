<script setup lang="ts">
import type { DashboardDailySale } from '~/types/dashboard'
import { dashboardCurrency } from '~/utils/dashboardFormatters'

const props = defineProps<{
  data: DashboardDailySale[]
  periodLabel: string
}>()

const total = computed(() => props.data.reduce((sum, item) => sum + item.total, 0))
const hasSales = computed(() => props.data.some(item => item.total > 0))
const recentDays = computed(() => props.data.slice(-7))
const maximum = computed(() => Math.max(...recentDays.value.map(item => item.total), 0))

function progress(item: DashboardDailySale) {
  return maximum.value > 0 ? (item.total / maximum.value) * 100 : 0
}
</script>

<template>
  <UCard :ui="{ header: 'pb-3', body: 'pt-2' }">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 class="font-semibold text-highlighted">
            Ventas de los últimos 7 días
          </h2>
          <p class="mt-1 text-sm text-muted capitalize">
            Tendencia diaria de {{ periodLabel }}
          </p>
        </div>
        <UBadge
          :label="dashboardCurrency.format(total)"
          icon="i-lucide-chart-column"
          color="primary"
          variant="soft"
        />
      </div>
    </template>

    <div v-if="hasSales" class="space-y-5">
      <div
        v-for="item in recentDays"
        :key="item.date"
        class="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_7rem] sm:items-center"
      >
        <p class="text-sm text-muted">
          {{ item.label }}
        </p>
        <UProgress
          :model-value="progress(item)"
          color="primary"
          size="lg"
        />
        <div class="flex items-center justify-between gap-2 sm:block sm:text-right">
          <p class="text-sm font-medium text-highlighted">
            {{ dashboardCurrency.format(item.total) }}
          </p>
          <p class="text-xs text-muted">
            {{ item.orders }} {{ item.orders === 1 ? 'pedido' : 'pedidos' }}
          </p>
        </div>
      </div>
    </div>

    <UEmpty
      v-else
      icon="i-lucide-chart-spline"
      title="Aún no hay ventas este mes"
      description="La tendencia aparecerá aquí cuando se registren pedidos."
      class="h-80"
    />
  </UCard>
</template>
