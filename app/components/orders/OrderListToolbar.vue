<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
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

const newOrderItems = computed<DropdownMenuItem[][]>(() => [[
  {
    label: 'Cotización',
    icon: 'i-lucide-file-text',
    to: {
      path: '/ventas/nueva-cotizacion',
      query: { returnTo: props.returnTo }
    }
  },
  {
    label: 'Venta mostrador',
    icon: 'i-lucide-store',
    to: {
      path: '/ventas/nuevo-pedido',
      query: {
        tipo: 'mostrador',
        returnTo: props.returnTo
      }
    }
  },
  {
    label: 'Venta a domicilio',
    icon: 'i-lucide-truck',
    to: {
      path: '/ventas/nuevo-pedido',
      query: {
        tipo: 'domicilio',
        returnTo: props.returnTo
      }
    }
  }
]])
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

    <UDropdownMenu
      v-if="!igualacion && canCreate"
      :items="newOrderItems"
      :content="{ align: 'end', collisionPadding: 12 }"
      :ui="{ content: 'w-64' }"
    >
      <UButton
        label="Nuevo"
        icon="i-lucide-plus"
        trailing-icon="i-lucide-chevron-down"
        class="w-full justify-center data-[state=open]:bg-primary/90 sm:w-auto"
      />
    </UDropdownMenu>
  </div>
</template>
