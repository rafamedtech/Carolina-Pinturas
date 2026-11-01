<script setup lang="ts">
import type { ReportBreakdownItem } from '~/types/reports'
import { dashboardCompactCurrency } from '~/utils/dashboardFormatters'

const props = withDefaults(defineProps<{
  title: string
  description: string
  icon: string
  color: 'primary' | 'success' | 'warning' | 'info'
  items: ReportBreakdownItem[]
  emptyIcon: string
  emptyTitle: string
  countLabel: (count: number) => string
  limit?: number
}>(), { limit: 8 })

const accents = {
  primary: 'text-primary bg-primary/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  info: 'text-info bg-info/10'
}
const expanded = shallowRef(false)
const visible = computed(() => expanded.value ? props.items : props.items.slice(0, props.limit))
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
        <span class="flex size-8 shrink-0 items-center justify-center rounded-lg" :class="accents[color]">
          <UIcon :name="icon" class="size-4" />
        </span>
      </div>
    </template>

    <ul v-if="items.length" class="divide-y divide-default">
      <li v-for="item in visible" :key="item.key" class="py-3 first:pt-0 last:pb-0">
        <div class="flex items-baseline justify-between gap-4">
          <p class="truncate text-sm font-medium text-highlighted">
            {{ item.label }}
          </p>
          <p class="shrink-0 text-sm font-semibold tabular-nums text-highlighted">
            {{ dashboardCompactCurrency(item.amount) }}
          </p>
        </div>
        <UProgress
          :model-value="item.percentage"
          :color="color"
          size="xs"
          class="mt-2"
        />
        <div class="mt-1.5 flex items-center justify-between gap-4 text-xs text-muted">
          <span>{{ countLabel(item.count) }}</span>
          <span class="tabular-nums">{{ item.percentage }}%</span>
        </div>
      </li>
    </ul>

    <UEmpty
      v-else
      :icon="emptyIcon"
      :title="emptyTitle"
      class="py-12"
    />

    <UButton
      v-if="items.length > limit"
      :label="expanded ? 'Ver menos' : `Ver ${items.length - limit} más`"
      color="neutral"
      variant="link"
      size="sm"
      class="mt-3 px-0"
      @click="expanded = !expanded"
    />
  </UCard>
</template>
