<script setup lang="ts">
defineProps<{ title: string, description?: string }>()
</script>

<template>
  <UPageCard variant="naked" :description="description" :ui="{ container: 'gap-1', title: 'text-lg' }">
    <template #title>
      <h2 class="font-semibold text-highlighted">
        {{ title }}
      </h2>
    </template>
  </UPageCard>
</template>
