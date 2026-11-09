<script setup lang="ts">
import { reportCurrency } from '~/utils/reportPeriods'
import type { ReportBreakdownItem, ReportMetrics } from '~/types/reports'
import { dashboardNumber } from '~/utils/dashboardFormatters'

const props = defineProps<{ channels: ReportBreakdownItem[], metrics: ReportMetrics }>()
const total = computed(() => props.channels.reduce((sum, item) => sum + item.amount, 0))
const channelColors: Record<string, string> = {
  counter: 'bg-primary',
  seller: 'bg-success',
  internal: 'bg-warning'
}
const channelFills: Record<string, string> = {
  counter: 'fill-primary',
  seller: 'fill-success',
  internal: 'fill-warning'
}
const slices = computed(() => {
  let angle = -Math.PI / 2
  return props.channels.filter(channel => channel.amount > 0).map((channel) => {
    const start = angle
    angle += channel.amount / total.value * Math.PI * 2
    const middle = (start + angle) / 2
    const point = (value: number) => `${100 + 90 * Math.cos(value)} ${100 + 90 * Math.sin(value)}`
    return {
      ...channel,
      path: `M 100 100 L ${point(start)} A 90 90 0 0 1 ${point(middle)} A 90 90 0 0 1 ${point(angle)} Z`
    }
  })
})
const rows = computed(() => props.channels.map((channel) => {
  const previous = channel.key === 'counter'
    ? props.metrics.previousCounterSales
    : channel.key === 'seller' ? props.metrics.previousSellerSales : props.metrics.previousInternalSales
  return { ...channel, previous, change: previous ? (channel.amount - previous) / previous * 100 : null }
}))
</script>

<template>
  <DetailCard id="reports-sales-channels" class="min-w-0" :ui="{ container: 'min-w-0' }">
    <template #title>
      <DetailSectionHeading title="Ventas por canal" description="Mostrador, vendedor y clientes internos, según el cliente del pedido." :ui="{ title: 'text-base' }" />
    </template>

    <div class="flex flex-col items-center gap-6 lg:flex-row">
      <svg
        viewBox="0 0 200 200"
        class="size-48 shrink-0"
        role="img"
        :aria-label="total > 0 ? channels.map(item => `${item.label}: ${reportCurrency.format(item.amount)}, ${item.percentage}%`).join('. ') : 'Sin ventas en este periodo'"
      >
        <circle
          v-if="!total"
          cx="100"
          cy="100"
          r="90"
          class="fill-elevated"
        />
        <path
          v-for="slice in slices"
          :key="slice.key"
          :d="slice.path"
          :class="channelFills[slice.key]"
          class="stroke-default"
          stroke-width="2"
          stroke-linejoin="round"
        >
          <title>{{ slice.label }}: {{ reportCurrency.format(slice.amount) }} · {{ slice.percentage }}%</title>
        </path>
      </svg>

      <DetailFields :fields="rows.map(channel => ({ key: channel.key, label: channel.label }))" :columns="3" class="w-full min-w-0">
        <template #label="{ field }">
          <span v-for="channel in rows.filter(channel => channel.key === field.key)" :key="channel.key" class="flex items-center gap-2">
            <span class="size-2.5 rounded-full" :class="channelColors[channel.key]" />
            {{ channel.label }}
            <span class="ml-auto tabular-nums">{{ channel.percentage }}%</span>
          </span>
        </template>
        <template #value="{ field }">
          <template v-for="channel in rows.filter(channel => channel.key === field.key)" :key="channel.key">
            <p class="text-lg font-semibold tabular-nums text-highlighted">
              {{ reportCurrency.format(channel.amount) }}
            </p>
            <p class="mt-0.5 text-xs text-muted tabular-nums">
              {{ channel.count }} {{ channel.count === 1 ? 'venta' : 'ventas' }}
              · ant. {{ reportCurrency.format(channel.previous) }}
              <span v-if="channel.change !== null" :class="channel.change >= 0 ? 'text-success' : 'text-error'">
                ({{ channel.change > 0 ? '+' : '' }}{{ dashboardNumber.format(channel.change) }}%)
              </span>
            </p>
          </template>
        </template>
      </DetailFields>
    </div>

    <p v-if="!total" class="mt-5 text-sm text-muted">
      Sin ventas en este periodo.
    </p>
  </DetailCard>
</template>
