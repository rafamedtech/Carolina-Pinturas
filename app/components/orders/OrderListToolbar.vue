<script setup lang="ts">
import type { OrderStatus } from '~/types/orders'

const props = withDefaults(defineProps<{
  statuses: OrderStatus[]
  loading: boolean
  igualacion?: boolean
  canCreate?: boolean
}>(), {
  igualacion: false,
  canCreate: false
})

const emit = defineEmits<{
  refresh: []
}>()

const filter = defineModel<string>('filter', { required: true })
const status = defineModel<string>('status', { required: true })

const IGUALACION_STATUS_KEYS = ['confirmado', 'surtido', 'en_espera']

const statusOptions = computed(() => {
  const statuses = props.igualacion
    ? props.statuses.filter(item => IGUALACION_STATUS_KEYS.includes(item.key))
    : props.statuses
  return [{
    label: 'Todos los estados',
    value: 'all'
  }, ...statuses.map(item => ({
    label: item.label,
    value: item.key
  }))]
})
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
        v-if="!igualacion && canCreate"
        to="/ventas/nueva-cotizacion"
        label="Nueva cotización"
        icon="i-lucide-file-text"
        color="neutral"
        variant="outline"
      />
      <UButton
        v-if="!igualacion && canCreate"
        to="/ventas/nuevo-pedido"
        label="Nuevo pedido"
        icon="i-lucide-shopping-cart"
      />
    </div>
  </div>
</template>
