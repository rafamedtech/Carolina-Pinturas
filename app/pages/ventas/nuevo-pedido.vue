<script setup lang="ts">
import type { OrderSaleType } from '~/types/orders'

const route = useRoute()

const saleType = computed<OrderSaleType | undefined>(() => {
  if (route.query.tipo === 'mostrador') return 'counter'
  if (route.query.tipo === 'domicilio') return 'delivery'
  return undefined
})

const title = computed(() => {
  if (saleType.value === 'counter') return 'Venta mostrador'
  if (saleType.value === 'delivery') return 'Venta a domicilio'
  return 'Nuevo pedido'
})

useSeoMeta({ title })
</script>

<template>
  <OrdersOrderEditor :sale-type="saleType" />
</template>
