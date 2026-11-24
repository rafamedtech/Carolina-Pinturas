<script setup lang="ts">
import { buildReportSummaryCards } from '@rafamedtech/nuxt-shared/utils'
import type { ReportMetrics } from '~/types/reports'

const props = defineProps<{
  annual?: boolean
  metrics: ReportMetrics
}>()

const previousPeriod = computed(() => props.annual ? 'año anterior' : 'mes anterior')
const cards = computed(() => buildReportSummaryCards(props.metrics, {
  annual: props.annual,
  salesTitle: 'Ventas netas',
  singular: 'venta',
  plural: 'ventas'
}))
</script>

<template>
  <ReportsSummaryCards :cards="cards" :previous-period="previousPeriod" />
</template>
