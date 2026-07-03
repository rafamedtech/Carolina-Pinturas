<script setup lang="ts">
const route = useRoute()
const orderId = computed(() => String(route.params.id))

useSeoMeta({ title: 'Editar cotización' })
</script>

<template>
  <OrdersOrderEditor mode="quote" :order-id="orderId" />
</template>
