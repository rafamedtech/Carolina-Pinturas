<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { OrderDateRange } from '~/types/orders'
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '~/utils/orderPayment'

const props = withDefaults(defineProps<{
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
const hideCancelled = defineModel<boolean>('hideCancelled', { required: true })
const hideQuotes = defineModel<boolean>('hideQuotes', { required: true })
const dateRange = defineModel<OrderDateRange | null>('dateRange', { required: true })
const moreFiltersOpen = shallowRef(false)

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
}, ...PAYMENT_METHODS.filter(item => !['cheque', 'otro'].includes(item.key)).map(item => ({
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

const hasActiveFilters = computed(() => Boolean(
  filter.value
  || status.value !== 'all'
  || paymentStatus.value !== 'all'
  || paymentMethod.value !== 'all'
  || hideCancelled.value
  || hideQuotes.value
  || dateRange.value
))

function applyMoreFilters(filters: {
  paymentStatus: string
  paymentMethod: string
  hideCancelled: boolean
  hideQuotes: boolean
}) {
  paymentStatus.value = filters.paymentStatus
  paymentMethod.value = filters.paymentMethod
  hideCancelled.value = filters.hideCancelled
  hideQuotes.value = filters.hideQuotes
}

function clearFilters() {
  filter.value = ''
  status.value = 'all'
  paymentStatus.value = 'all'
  paymentMethod.value = 'all'
  hideCancelled.value = false
  hideQuotes.value = false
  dateRange.value = null
}
</script>

<template>
  <ListToolbar
    v-model:search="filter"
    placeholder="Buscar pedido o cliente"
    :has-active-filters="hasActiveFilters"
    @clear="clearFilters"
  >
    <template #filters>
      <OrdersOrderDateRangePicker v-model="dateRange" />
      <UButton
        label="Más filtros"
        icon="i-lucide-sliders-horizontal"
        color="neutral"
        variant="outline"
        class="w-full justify-start sm:w-auto sm:justify-center"
        @click="moreFiltersOpen = true"
      />
    </template>
    <template v-if="!igualacion && canCreate" #actions>
      <UDropdownMenu
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
    </template>
  </ListToolbar>
  <OrdersOrderListMoreFiltersModal
    v-model:open="moreFiltersOpen"
    :payment-status="paymentStatus"
    :payment-method="paymentMethod"
    :hide-cancelled="hideCancelled"
    :hide-quotes="hideQuotes"
    :payment-status-options="paymentStatusOptions"
    :payment-method-options="paymentMethodOptions"
    @apply="applyMoreFilters"
  />
</template>
