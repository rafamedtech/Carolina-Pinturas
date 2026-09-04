<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { OrderDateRange } from '~/types/orders'
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '~/utils/orderPayment'

const props = withDefaults(defineProps<{
  items: Array<{ label: string, value: string }>
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
        :items="items"
        value-key="value"
        class="w-full sm:hidden"
      />
      <OrdersOrderDateRangePicker v-model="dateRange" />
      <div v-if="!igualacion" class="flex w-full gap-2 sm:w-auto">
        <UButton
          label="Más filtros"
          icon="i-lucide-sliders-horizontal"
          color="neutral"
          variant="outline"
          class="flex-1 justify-start sm:flex-none sm:justify-center"
          @click="moreFiltersOpen = true"
        />
        <UButton
          v-if="hasActiveFilters"
          label="Quitar filtros"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          class="flex-1 justify-center sm:flex-none"
          @click="clearFilters"
        />
      </div>
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

    <OrdersOrderListMoreFiltersModal
      v-if="!igualacion"
      v-model:open="moreFiltersOpen"
      :payment-status="paymentStatus"
      :payment-method="paymentMethod"
      :hide-cancelled="hideCancelled"
      :hide-quotes="hideQuotes"
      :payment-status-options="paymentStatusOptions"
      :payment-method-options="paymentMethodOptions"
      @apply="applyMoreFilters"
    />
  </div>
</template>
