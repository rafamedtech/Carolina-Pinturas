<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import type { OrderStatus, Repartidor } from '~/types/orders'
import type { SiigoCustomer } from '~/types/siigo'
import { PAYMENT_STATUSES, PAYMENT_METHODS } from '~/utils/orderPayment'
import { siigoCustomerPhone, siigoCustomerAddress } from '~/utils/siigoCustomer'

const props = withDefaults(defineProps<{
  customers: SiigoCustomer[]
  statuses: OrderStatus[]
  repartidores: Repartidor[]
  loading: boolean
  disabled: boolean
  repartidorRequired?: boolean
  showStatus?: boolean
  showPayment?: boolean
  quoteMode?: boolean
}>(), {
  repartidorRequired: false,
  showStatus: true,
  showPayment: true,
  quoteMode: false
})

const emit = defineEmits<{
  customerCreated: [customer: SiigoCustomer]
}>()

const customerId = defineModel<string>('customerId', { required: true })
const statusKey = defineModel<string>('statusKey', { required: true })
const repartidorId = defineModel<string>('repartidorId', { required: true })
const orderDate = defineModel<string>('orderDate', { required: true })
const promisedDate = defineModel<string>('promisedDate', { required: true })
const observations = defineModel<string>('observations', { required: true })
const paymentStatus = defineModel<string>('paymentStatus', { required: true })
const paymentMethod = defineModel<string>('paymentMethod', { required: true })
const paymentDate = defineModel<string>('paymentDate', { required: true })
const requiresInvoice = defineModel<boolean>('requiresInvoice', { required: true })

const orderDateValue = computed<DateValue | undefined>({
  get: () => orderDate.value ? parseDate(orderDate.value) : undefined,
  set: (value) => {
    orderDate.value = value?.toString() ?? ''
  }
})
const promisedDateValue = computed<DateValue | undefined>({
  get: () => promisedDate.value ? parseDate(promisedDate.value) : undefined,
  set: (value) => {
    promisedDate.value = value?.toString() ?? ''
  }
})
const paymentDateValue = computed<DateValue | undefined>({
  get: () => paymentDate.value ? parseDate(paymentDate.value) : undefined,
  set: (value) => {
    paymentDate.value = value?.toString() ?? ''
  }
})

function customerName(customer: SiigoCustomer) {
  return customer.name?.filter(Boolean).join(' ') || customer.rfc_id || 'Cliente sin nombre'
}

const customerOptions = computed(() => props.customers.map(customer => ({
  label: customerName(customer),
  description: customer.rfc_id || customer.identification,
  value: customer.id
})))
const statusOptions = computed(() => props.statuses.map(status => ({
  label: status.label,
  value: status.key
})))
const repartidorOptions = computed(() => props.repartidores.map(repartidor => ({
  label: repartidor.nombre,
  value: repartidor.id
})))
const paymentStatusOptions = PAYMENT_STATUSES.map(status => ({
  label: status.label,
  value: status.key as string
}))
const paymentMethodOptions = PAYMENT_METHODS.map(method => ({
  label: method.label,
  value: method.key as string
}))

const selectedCustomer = computed(() =>
  props.customers.find(customer => customer.id === customerId.value))
const selectedCustomerPhone = computed(() => siigoCustomerPhone(selectedCustomer.value))
const selectedCustomerAddress = computed(() => siigoCustomerAddress(selectedCustomer.value))

const createCustomerOpen = shallowRef(false)
const createCustomerName = shallowRef('')

function openCreateCustomer(searchTerm: string) {
  createCustomerName.value = searchTerm.trim()
  createCustomerOpen.value = true
}

function onCustomerCreated(customer: SiigoCustomer) {
  emit('customerCreated', customer)
  customerId.value = customer.id
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-highlighted">
        {{ props.quoteMode ? 'Datos de la cotización' : 'Información general' }}
      </h2>
    </template>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        name="customerId"
        label="Cliente"
        required
        class="sm:col-span-2"
      >
        <!--
          when:'always' para no esconder "crear cliente" ante coincidencias
          parciales (nombres/RFC comunes). `position` es obligatorio: en esta
          versión de Nuxt UI, createItemPosition solo hace fallback a "bottom"
          cuando createItem NO es objeto; con objeto sin position explícito
          queda undefined y el ítem nunca se renderiza.
        -->
        <USelectMenu
          v-model="customerId"
          :items="customerOptions"
          value-key="value"
          :loading="loading"
          :disabled="disabled"
          :create-item="{ when: 'always', position: 'bottom' }"
          placeholder="Buscar cliente"
          class="w-full"
          @create="openCreateCustomer"
        >
          <template #create-item-label="{ item }">
            Crear cliente “{{ item }}”
          </template>
        </USelectMenu>
      </UFormField>

      <div
        v-if="selectedCustomer && (selectedCustomerPhone || selectedCustomerAddress)"
        class="grid gap-4 sm:col-span-2 sm:grid-cols-2"
      >
        <div v-if="selectedCustomerPhone">
          <p class="text-sm text-muted">
            Teléfono
          </p>
          <p class="font-medium">
            {{ selectedCustomerPhone }}
          </p>
        </div>
        <div v-if="selectedCustomerAddress">
          <p class="text-sm text-muted">
            Domicilio
          </p>
          <p class="font-medium">
            {{ selectedCustomerAddress }}
          </p>
        </div>
      </div>

      <OrdersOrderCustomerCreateModal
        v-model:open="createCustomerOpen"
        :customers="props.customers"
        :initial-name="createCustomerName"
        @created="onCustomerCreated"
      />

      <UFormField
        v-if="props.showStatus"
        name="statusKey"
        label="Estado inicial"
        required
      >
        <USelect
          v-model="statusKey"
          :items="statusOptions"
          value-key="value"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>

      <UFormField
        v-if="!props.quoteMode"
        name="repartidorId"
        label="Repartidor"
        :required="props.repartidorRequired"
        class="sm:col-span-2"
      >
        <USelect
          v-model="repartidorId"
          :items="repartidorOptions"
          value-key="value"
          :loading="loading"
          :disabled="disabled"
          placeholder="Selecciona un repartidor"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="orderDate"
        :label="props.quoteMode ? 'Fecha de la cotización' : 'Fecha del pedido'"
        required
        :class="{ 'sm:col-span-2': props.quoteMode }"
      >
        <OrdersOrderDatePicker
          v-model="orderDateValue"
          :disabled="disabled"
          placeholder="Seleccionar fecha del pedido"
        />
      </UFormField>

      <UFormField v-if="!props.quoteMode" name="promisedDate" label="Fecha de entrega">
        <OrdersOrderDatePicker
          v-model="promisedDateValue"
          :disabled="disabled"
          placeholder="Seleccionar fecha de entrega"
        />
      </UFormField>

      <UFormField
        v-if="!props.quoteMode && props.showPayment"
        name="paymentStatus"
        label="Estado de pago"
        required
      >
        <USelect
          v-model="paymentStatus"
          :items="paymentStatusOptions"
          value-key="value"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>

      <UFormField
        v-if="!props.quoteMode && props.showPayment"
        name="paymentMethod"
        label="Método de pago"
      >
        <USelect
          v-model="paymentMethod"
          :items="paymentMethodOptions"
          value-key="value"
          :disabled="disabled"
          placeholder="Selecciona un método"
          class="w-full"
        />
      </UFormField>

      <UFormField
        v-if="!props.quoteMode && props.showPayment"
        name="paymentDate"
        label="Fecha de pago"
      >
        <OrdersOrderDatePicker
          v-model="paymentDateValue"
          :disabled="disabled"
          placeholder="Seleccionar fecha de pago"
        />
      </UFormField>

      <UFormField v-if="!props.quoteMode" name="requiresInvoice" label="Facturación">
        <USwitch v-model="requiresInvoice" :disabled="disabled" label="Requiere factura" />
      </UFormField>

      <UFormField name="observations" label="Observaciones" class="sm:col-span-2">
        <UTextarea
          v-model="observations"
          :rows="3"
          :disabled="disabled"
          placeholder="Indicaciones de entrega, referencias o notas internas"
          class="w-full"
          :ui="{ base: 'resize-none' }"
        />
      </UFormField>
    </div>
  </UCard>
</template>
