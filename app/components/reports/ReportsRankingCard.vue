<script setup lang="ts">
import { reportCurrency } from '~/utils/reportPeriods'
import type { ReportRankingItem } from '~/types/reports'
import { dashboardCompactCurrency } from '~/utils/dashboardFormatters'

const props = withDefaults(defineProps<{
  title: string
  description: string
  icon: string
  empty: string
  items: ReportRankingItem[]
  countLabel: (count: number) => string
  exactAmounts?: boolean
  color?: 'primary' | 'material'
}>(), { color: 'primary' })

const accent = computed(() => props.color === 'material' ? 'bg-violet-500/10 text-violet-500' : 'bg-primary/10 text-primary')
const bar = computed(() => props.color === 'material' ? 'bg-violet-500' : 'bg-primary')
</script>

<template>
  <UCard :ui="{ header: 'pb-3', body: 'pt-4' }">
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-highlighted">
            {{ title }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ description }}
          </p>
        </div>
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg" :class="accent">
          <UIcon :name="icon" class="size-4" />
        </span>
      </div>
    </template>

    <slot name="summary" />

    <ol v-if="items.length" class="divide-y divide-default">
      <li v-for="(item, index) in items" :key="item.id" class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
          :class="index === 0 ? accent : 'bg-elevated text-muted'"
        >
          {{ index + 1 }}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-3">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ item.label }}
            </p>
            <p class="shrink-0 text-sm font-semibold tabular-nums text-highlighted">
              {{ exactAmounts ? reportCurrency.format(item.amount) : dashboardCompactCurrency(item.amount) }}
            </p>
          </div>
          <div class="mt-2 h-1 overflow-hidden rounded-full bg-accented">
            <div class="h-full rounded-full" :class="bar" :style="{ width: `${Math.min(item.percentage, 100)}%` }" />
          </div>
          <p class="mt-1.5 truncate text-xs text-muted">
            {{ item.detail }} · {{ countLabel(item.count) }} · {{ item.percentage }}%
          </p>
        </div>
      </li>
    </ol>

    <UEmpty
      v-else
      :icon="icon"
      :title="empty"
      class="py-12"
    />
  </UCard>
</template>
