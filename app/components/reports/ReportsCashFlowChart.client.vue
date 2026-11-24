<script setup lang="ts">
import type { ReportDailyMovement } from '~/types/reports'
import SharedReportsCashFlowChart from '#layers/nuxt-shared/app/components/reports/ReportsCashFlowChart.client.vue'
import { reportFlowSeries } from '~/utils/reportPeriods'

const props = defineProps<{
  data: ReportDailyMovement[]
  annual?: boolean
}>()

const movements = computed(() => reportFlowSeries(props.data, props.annual))
</script>

<template>
  <SharedReportsCashFlowChart
    :ui="{ title: 'text-base' }"
    :movements="movements"
    :annual="annual"
  />
</template>
