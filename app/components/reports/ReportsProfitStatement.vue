<script setup lang="ts">
import type { ReportMetrics } from '~/types/reports'

defineProps<{ metrics: ReportMetrics, annual?: boolean }>()
</script>

<template>
  <ReportsProfitStatementCard
    title="Estado de resultados"
    :description="`De la venta neta a la utilidad, con la variación contra el ${annual ? 'año' : 'mes'} anterior.`"
    :caption="`Estado de resultados del ${annual ? 'año' : 'mes'} en pesos mexicanos, antes de IVA`"
    sales-label="Ventas netas"
    :metrics="metrics"
    :annual="annual"
    :ui="{ title: 'text-base' }"
  />
</template>
