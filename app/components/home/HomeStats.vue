<script setup lang="ts">
import type { DashboardMetrics } from '~/types/dashboard'
import { dashboardCurrency, dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{
  metrics: DashboardMetrics
}>()

const stats = computed(() => [{
  title: 'Pedidos del mes',
  value: dashboardNumber.format(props.metrics.orderCount),
  detail: 'Pedidos que ya son venta',
  icon: 'i-lucide-shopping-bag'
}, {
  title: 'Ticket promedio',
  value: dashboardCurrency.format(props.metrics.averageTicket),
  detail: 'Promedio por pedido',
  icon: 'i-lucide-receipt-text'
}, {
  title: 'Venta cobrada',
  value: dashboardCurrency.format(props.metrics.collectedAmount),
  detail: `${props.metrics.sales > 0 ? Math.round((props.metrics.collectedAmount / props.metrics.sales) * 100) : 0}% de la venta mensual`,
  icon: 'i-lucide-circle-check-big'
}, {
  title: 'Por cobrar',
  value: dashboardCurrency.format(props.metrics.pendingAmount),
  detail: 'Pendiente o con abono',
  icon: 'i-lucide-clock-3'
}])
</script>

<template>
  <UPageGrid class="gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <UPageCard
      v-for="stat in stats"
      :key="stat.title"
      :title="stat.title"
      :description="stat.detail"
      :icon="stat.icon"
      variant="subtle"
      :ui="{ container: 'gap-y-2' }"
    >
      <p class="text-2xl font-semibold tracking-tight text-highlighted">
        {{ stat.value }}
      </p>
    </UPageCard>
  </UPageGrid>
</template>
