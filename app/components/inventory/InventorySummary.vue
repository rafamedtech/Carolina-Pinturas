<script setup lang="ts">
import type { InventorySummary } from '#shared/types/inventory'

defineProps<{ summary: InventorySummary }>()
const emit = defineEmits<{ view: [view: 'stocks' | 'reservations' | 'counts' | 'movements', belowMinimum?: boolean] }>()
</script>

<template>
  <div class="min-w-0 space-y-6">
    <InventorySummaryMetrics :summary="summary" @view="(view, low) => emit('view', view, low)" />

    <InventoryValuation :valuation="summary.valuation" />

    <DetailCard>
      <DetailSectionHeading title="Seguimiento del inventario" description="Revisa los conteos pendientes y los almacenes activos.">
        <template #actions>
          <AppButton
            label="Ver conteos"
            intent="secondary"
            trailing-icon="i-lucide-arrow-up-right"
            @click="emit('view', 'counts')"
          />
        </template>
      </DetailSectionHeading>
      <DetailFields
        :fields="[
          { label: 'Conteos por aplicar', value: summary.pendingCounts },
          { label: 'Almacenes activos', value: `${summary.activeWarehouses} de ${summary.valuation.warehouses.length}` }
        ]"
      />
    </DetailCard>

    <InventoryRecentMovements :movements="summary.recentMovements" @view="emit('view', 'movements')" />
  </div>
</template>
