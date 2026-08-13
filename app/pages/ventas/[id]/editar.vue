<script setup lang="ts">
const route = useRoute()
const orderId = computed(() => String(route.params.id))

useSeoMeta({ title: 'Editar pedido' })
</script>

<template>
  <OrdersOrderEditor :order-id="orderId" />
</template>
