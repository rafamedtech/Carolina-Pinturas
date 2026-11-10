<script setup lang="ts">
import type { InventorySummary } from '#shared/types/inventory'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ summary: InventorySummary }>()
const emit = defineEmits<{ view: [view: 'stocks' | 'reservations', belowMinimum?: boolean] }>()
const metrics = computed(() => [
  { title: 'Control activo', value: props.summary.trackedProducts, icon: 'i-lucide-package-check', detail: 'Productos activos con control interno.', label: 'Ver existencias', view: 'stocks' as const },
  { title: 'Con existencias', value: props.summary.stockedProducts, icon: 'i-lucide-boxes', detail: 'Productos activos con control y existencia física.', label: 'Ver existencias', view: 'stocks' as const },
  { title: 'Con reservas', value: props.summary.reservedProducts, icon: 'i-lucide-bookmark', detail: 'Productos activos con control y mercancía apartada.', label: 'Ver reservas', view: 'reservations' as const },
  { title: 'Bajo mínimo', value: props.summary.lowStockLocations, icon: 'i-lucide-package-minus', detail: 'Registros de producto y almacén con disponible menor al mínimo.', label: 'Revisar faltantes', view: 'stocks' as const, low: true }
])
</script>

<template>
  <UPageGrid class="gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <DetailStatCard
      v-for="metric in metrics"
      :key="metric.title"
      :title="metric.title"
      :icon="metric.icon"
      :value="dashboardNumber.format(metric.value)"
    >
      <p class="text-xs text-muted">
        {{ metric.detail }}
      </p>
      <AppButton
        :label="metric.label"
        intent="quiet"
        size="sm"
        trailing-icon="i-lucide-arrow-up-right"
        class="mt-auto self-start"
        @click="emit('view', metric.view, metric.low)"
      />
    </DetailStatCard>
  </UPageGrid>
</template>
