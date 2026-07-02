<script setup lang="ts">
import type { OrderStatus } from '~/types/orders'

const props = defineProps<{
  status: Pick<OrderStatus, 'label' | 'color'>
}>()

const color = computed(() => orderStatusBadgeColor(props.status.color))
</script>

<template>
  <UBadge :color="color" variant="subtle">
    {{ status.label }}
  </UBadge>
</template>
