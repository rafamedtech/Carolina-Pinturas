<script setup lang="ts">
definePageMeta({
  middleware: to => navigateTo({ path: '/clientes', query: { ...to.query, view: 'proveedores' } }, { replace: true })
})
</script>

<template>
  <div />
</template>
