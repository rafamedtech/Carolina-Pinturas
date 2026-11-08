<script setup lang="ts">
defineProps<{ title: string, description?: string, hideTitleOnMobile?: boolean }>()
</script>

<template>
  <DetailCard
    variant="naked"
    :description="description"
    :ui="{ container: 'gap-1', title: hideTitleOnMobile ? 'hidden text-lg sm:block' : 'text-lg' }"
  >
    <template #title>
      <h2 class="font-semibold text-highlighted">
        {{ title }}
      </h2>
    </template>
  </DetailCard>
</template>
