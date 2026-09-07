<script setup lang="ts">
import { reportCurrency } from '~/utils/reportPeriods'
import type { ReportBreakdownItem } from '~/types/reports'

const props = defineProps<{ channels: ReportBreakdownItem[] }>()
const total = computed(() => props.channels.reduce((sum, item) => sum + item.amount, 0))
const share = computed(() => total.value > 0 ? (props.channels.find(item => item.key === 'counter')?.amount ?? 0) / total.value * 100 : 0)
const background = computed(() => total.value > 0
  ? `conic-gradient(var(--ui-primary) 0% ${share.value}%, var(--ui-success) ${share.value}% 100%)`
  : 'var(--ui-bg-elevated)')
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-base font-semibold text-highlighted">
        Mostrador vs. clientes del vendedor
      </h2>
      <p class="mt-1 text-sm text-muted">
        Participación sobre el total vendido del mes, según el cliente del pedido.
      </p>
    </template>
    <div class="flex flex-col items-center gap-8 sm:flex-row">
      <div
        class="relative size-48 shrink-0 rounded-full"
        :style="{ background }"
        role="img"
        :aria-label="channels.map(item => `${item.label}: ${reportCurrency.format(item.amount)}, ${item.percentage}%`).join('. ')"
      >
        <div class="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-default">
          <span class="text-xs text-muted">Total vendido</span>
          <span class="mt-1 text-sm font-semibold tabular-nums text-highlighted">{{ reportCurrency.format(total) }}</span>
        </div>
      </div>
      <dl class="w-full space-y-5">
        <div v-for="channel in channels" :key="channel.key">
          <dt class="flex items-center gap-2 text-sm text-muted">
            <span class="size-2.5 rounded-full" :class="channel.key === 'counter' ? 'bg-primary' : 'bg-success'" />
            {{ channel.label }}
          </dt>
          <dd class="mt-1 flex flex-wrap items-baseline justify-between gap-2">
            <span class="text-xl font-semibold tabular-nums text-highlighted">{{ reportCurrency.format(channel.amount) }}</span>
            <span class="text-sm text-muted">{{ channel.count }} ventas · {{ channel.percentage }}%</span>
          </dd>
        </div>
      </dl>
    </div>
    <p v-if="!total" class="mt-5 text-sm text-muted">
      Sin ventas en este periodo.
    </p>
  </UCard>
</template>
