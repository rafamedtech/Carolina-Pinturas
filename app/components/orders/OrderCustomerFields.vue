<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import type { OrderStatus, Repartidor } from '~/types/orders'
import type { SiigoCustomer } from '~/types/siigo'

const props = withDefaults(defineProps<{
  customers: SiigoCustomer[]
  statuses: OrderStatus[]
  repartidores: Repartidor[]
  loading: boolean
  disabled: boolean
  repartidorRequired?: boolean
  showStatus?: boolean
  quoteMode?: boolean
}>(), {
  repartidorRequired: false,
  showStatus: true,
  quoteMode: false
})

const customerId = defineModel<string>('customerId', { required: true })
const statusKey = defineModel<string>('statusKey', { required: true })
const repartidorId = defineModel<string>('repartidorId', { required: true })
const orderDate = defineModel<string>('orderDate', { required: true })
const promisedDate = defineModel<string>('promisedDate', { required: true })
const observations = defineModel<string>('observations', { required: true })

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
  description: repartidor.telefono || undefined,
  value: repartidor.id
})))
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
        <USelectMenu
          v-model="customerId"
          :items="customerOptions"
          value-key="value"
          :loading="loading"
          :disabled="disabled"
          placeholder="Buscar cliente"
          class="w-full"
        />
      </UFormField>

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
        <USelectMenu
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

      <UFormField v-if="!props.quoteMode" name="promisedDate" label="Fecha prometida">
        <OrdersOrderDatePicker
          v-model="promisedDateValue"
          :disabled="disabled"
          placeholder="Seleccionar fecha prometida"
        />
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
