<script setup lang="ts">
const route = useRoute()
const orderId = computed(() => String(route.params.id))
</script>

<template>
  <OrdersOrderDetail :order-id="orderId" />
</template>
