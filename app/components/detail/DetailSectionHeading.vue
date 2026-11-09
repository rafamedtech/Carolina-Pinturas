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
    :ui="{ container: 'gap-1', title: hideTitleOnMobile ? 'hidden text-lg sm:block' : 'text-lg' }"
  >
    <template #title>
      <h2 :id="titleId" class="flex items-center gap-2 font-semibold" :class="color === 'primary' ? 'text-primary' : 'text-highlighted'">
        <slot name="leading" />
        {{ title }}
      </h2>
    </template>
  </DetailCard>
</template>
