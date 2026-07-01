<script setup lang="ts">
import type { OrderStatus } from '~/types/orders'

const props = defineProps<{
  statuses: OrderStatus[]
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const filter = defineModel<string>('filter', { required: true })
const status = defineModel<string>('status', { required: true })

const statusOptions = computed(() => [{
  label: 'Todos los estados',
  value: 'all'
}, ...props.statuses.map(item => ({
  label: item.label,
  value: item.key
}))])
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <UInput
        v-model="filter"
        icon="i-lucide-search"
        placeholder="Buscar pedido o cliente"
        class="w-full sm:w-80"
      />
      <USelect
        v-model="status"
        :items="statusOptions"
        value-key="value"
        class="w-full sm:w-48"
      />
    </div>

    <div class="flex gap-2">
      <UButton
        label="Actualizar"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="loading"
        @click="emit('refresh')"
      />
      <UButton
        to="/ventas/nuevo-pedido"
        label="Nuevo pedido"
        icon="i-lucide-shopping-cart"
      />
    </div>
  </div>
</template>
