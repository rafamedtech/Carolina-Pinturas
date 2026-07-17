<script setup lang="ts">
import type { OrderDateRange, OrderStatus } from '~/types/orders'
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '~/utils/orderPayment'

const props = withDefaults(defineProps<{
  statuses: OrderStatus[]
  returnTo: string
  igualacion?: boolean
  canCreate?: boolean
}>(), {
  igualacion: false,
  canCreate: false
})

const filter = defineModel<string>('filter', { required: true })
const status = defineModel<string>('status', { required: true })
const paymentStatus = defineModel<string>('paymentStatus', { required: true })
const paymentMethod = defineModel<string>('paymentMethod', { required: true })
const dateRange = defineModel<OrderDateRange | null>('dateRange', { required: true })

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

const paymentStatusOptions = [{
  label: 'Todos los pagos',
  value: 'all'
}, ...PAYMENT_STATUSES.map(item => ({
  label: item.label,
  value: item.key as string
}))]

const paymentMethodOptions = [{
  label: 'Todos los métodos',
  value: 'all'
}, ...PAYMENT_METHODS.map(item => ({
  label: item.label,
  value: item.key as string
}))]
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
        class="w-full sm:hidden"
      />
      <USelect
        v-if="!igualacion"
        v-model="paymentStatus"
        :items="paymentStatusOptions"
        value-key="value"
        class="w-full sm:w-48"
      />
      <USelect
        v-if="!igualacion"
        v-model="paymentMethod"
        :items="paymentMethodOptions"
        value-key="value"
        class="w-full sm:w-48"
      />
      <OrdersOrderDateRangePicker v-model="dateRange" />
    </div>

    <div class="flex w-full gap-2 sm:w-auto">
      <UButton
        v-if="!igualacion && canCreate"
        :to="{
          path: '/ventas/nueva-cotizacion',
          query: { returnTo }
        }"
        icon="i-lucide-file-text"
        color="neutral"
        variant="outline"
        class="flex-1 justify-center sm:flex-none"
      >
        <span class="sm:hidden">Cotización</span>
        <span class="hidden sm:inline">Nueva cotización</span>
      </UButton>
      <UButton
        v-if="!igualacion && canCreate"
        :to="{
          path: '/ventas/nuevo-pedido',
          query: { returnTo }
        }"
        icon="i-lucide-shopping-cart"
        class="flex-1 justify-center sm:flex-none"
      >
        <span class="sm:hidden">Pedido</span>
        <span class="hidden sm:inline">Nuevo pedido</span>
      </UButton>
    </div>
  </div>
</template>
