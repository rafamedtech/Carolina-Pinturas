<script setup lang="ts">
import { reportCurrency } from '~/utils/reportPeriods'

defineProps<{
  id: string
  title: string
  marker: string
  amount?: number
}>()
</script>

<template>
  <div class="flex items-baseline justify-between gap-3 border-b border-default pt-4 pb-2">
    <DetailSectionHeading
      :title-id="id"
      :title="title"
      color="primary"
      :ui="{ title: 'text-base tracking-tight' }"
    >
      <template #leading>
        <span class="h-4 w-1 rounded-full" :class="marker" aria-hidden="true" />
      </template>
    </DetailSectionHeading>
    <p v-if="amount !== undefined" class="text-sm font-semibold tabular-nums text-muted">
      {{ reportCurrency.format(amount) }}
    </p>
  </div>
</template>
