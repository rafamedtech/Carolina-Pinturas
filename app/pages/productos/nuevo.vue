<script setup lang="ts">
const route = useRoute()
const sourceId = computed(() => typeof route.query.duplicar === 'string' ? route.query.duplicar : undefined)
</script>

<template>
  <ProductsProductEditor :key="sourceId" :duplicate-from="sourceId" />
</template>
