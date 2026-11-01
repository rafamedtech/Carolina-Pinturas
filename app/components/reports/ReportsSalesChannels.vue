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
const rows = computed(() => props.channels.map((channel) => {
  const previous = channel.key === 'counter'
    ? props.metrics.previousCounterSales
    : channel.key === 'seller' ? props.metrics.previousSellerSales : props.metrics.previousInternalSales
  return { ...channel, previous, change: previous ? (channel.amount - previous) / previous * 100 : null }
}))
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-base font-semibold text-highlighted">
        Ventas por canal
      </h2>
      <p class="mt-1 text-sm text-muted">
        Mostrador, vendedor y clientes internos, según el cliente del pedido.
      </p>
    </template>

    <div
      class="flex h-3 overflow-hidden rounded-full bg-elevated"
      role="img"
      :aria-label="channels.map(item => `${item.label}: ${reportCurrency.format(item.amount)}, ${item.percentage}%`).join('. ')"
    >
      <div
        v-for="channel in channels"
        :key="channel.key"
        :class="channelColors[channel.key]"
        :style="{ width: `${total > 0 ? channel.amount / total * 100 : 0}%` }"
      />
    </div>

    <dl class="mt-5 grid gap-4 sm:grid-cols-3">
      <div v-for="channel in rows" :key="channel.key">
        <dt class="flex items-center gap-2 text-sm text-muted">
          <span class="size-2.5 rounded-full" :class="channelColors[channel.key]" />
          {{ channel.label }}
          <span class="ml-auto tabular-nums">{{ channel.percentage }}%</span>
        </dt>
        <dd class="mt-1">
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
        </dd>
      </div>
    </dl>

    <p v-if="!total" class="mt-5 text-sm text-muted">
      Sin ventas en este periodo.
    </p>
  </UCard>
</template>
