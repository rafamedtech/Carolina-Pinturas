<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <ProductsProductEditor :key="String(route.params.id)" :product-id="String(route.params.id)" />
</template>
