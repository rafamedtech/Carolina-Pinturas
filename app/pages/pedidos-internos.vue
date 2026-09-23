<script setup lang="ts">
const route = useRoute()

await navigateTo({
  path: '/ventas',
  query: {
    ...route.query,
    view: 'internos'
  }
}, { replace: true })
</script>

<template>
  <div />
</template>
