<script setup lang="ts">
import { parseDate } from '@internationalized/date'

const model = defineModel<string>({ required: true })
const date = computed({ get: () => model.value ? parseDate(model.value) : undefined, set: (value) => {
  model.value = value?.toString() ?? ''
} })
</script>

<template>
  <OrdersOrderDatePicker v-model="date" />
</template>
