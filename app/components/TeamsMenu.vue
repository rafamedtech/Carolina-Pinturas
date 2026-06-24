<script setup lang="ts">
defineProps<{
  collapsed?: boolean
}>()
</script>

<template>
  <UButton
    label="Carolina Pinturas"
    :avatar="{ src: '/carolina-logo.jpg', alt: 'Carolina Pinturas' }"
    color="neutral"
    variant="ghost"
    block
    :square="collapsed"
    class="py-2"
    :ui="{ leadingAvatar: 'ring-1 ring-default' }"
  />
</template>
