<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  hideTitleOnMobile?: boolean
  titleId?: string
  color?: 'primary' | 'neutral'
}>()
</script>

<template>
  <DetailCard
    variant="naked"
    :description="description"
    :ui="{
      container: $slots.actions ? 'flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center lg:flex' : 'gap-1',
      wrapper: $slots.actions ? 'min-w-0 flex-1' : undefined,
      title: hideTitleOnMobile ? 'hidden text-lg sm:block' : 'text-lg'
    }"
  >
    <template #title>
      <h2 :id="titleId" class="flex items-center gap-2 font-semibold" :class="color === 'primary' ? 'text-primary' : 'text-highlighted'">
        <slot name="leading" />
        {{ title }}
      </h2>
    </template>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </DetailCard>
</template>
