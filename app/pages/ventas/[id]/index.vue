<script setup lang="ts">
const route = useRoute()
const orderId = computed(() => String(route.params.id))

useSeoMeta({ title: 'Detalle del pedido' })
</script>

<template>
  <OrdersOrderDetail :order-id="orderId" />
</template>
