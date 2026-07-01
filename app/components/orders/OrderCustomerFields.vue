<script setup lang="ts">
import type { OrderStatus } from '~/types/orders'
import type { SiigoCustomer } from '~/types/siigo'

const props = defineProps<{
  customers: SiigoCustomer[]
  statuses: OrderStatus[]
  loading: boolean
  disabled: boolean
}>()

const customerId = defineModel<string>('customerId', { required: true })
const statusKey = defineModel<string>('statusKey', { required: true })
const orderDate = defineModel<string>('orderDate', { required: true })
const promisedDate = defineModel<string>('promisedDate', { required: true })
const observations = defineModel<string>('observations', { required: true })

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
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-highlighted">
        Datos del pedido
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

      <UFormField name="statusKey" label="Estado inicial" required>
        <USelect
          v-model="statusKey"
          :items="statusOptions"
          value-key="value"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>

      <UFormField name="orderDate" label="Fecha del pedido" required>
        <UInput
          v-model="orderDate"
          type="date"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>

      <UFormField name="promisedDate" label="Fecha prometida">
        <UInput
          v-model="promisedDate"
          type="date"
          :disabled="disabled"
          class="w-full"
        />
      </UFormField>

      <UFormField name="observations" label="Observaciones" class="sm:col-span-2">
        <UTextarea
          v-model="observations"
          :rows="3"
          :disabled="disabled"
          placeholder="Indicaciones de entrega, referencias o notas internas"
          class="w-full"
        />
      </UFormField>
    </div>
  </UCard>
</template>
