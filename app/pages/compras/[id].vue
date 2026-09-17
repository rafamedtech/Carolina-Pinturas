<script setup lang="ts">
useSeoMeta({ title: 'Orden de compra' })
const route = useRoute()
</script>

<template>
  <PurchasesPurchaseDetail :id="String(route.params.id)" />
</template>
