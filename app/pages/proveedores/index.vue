<script setup lang="ts">
const route = useRoute()
await navigateTo({ path: '/clientes', query: { ...route.query, view: 'proveedores' } }, { replace: true })
</script>

<template>
  <div />
</template>
