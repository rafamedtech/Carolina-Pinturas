<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <UButton
    label="Carolina Pinturas"
    icon="i-lucide-paint-roller"
    color="neutral"
    variant="ghost"
    block
    :square="collapsed"
    class="py-2"
    :ui="{ leadingIcon: 'text-primary' }"
  />
</template>
