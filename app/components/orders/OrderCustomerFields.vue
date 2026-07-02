<script setup lang="ts">
import type { OrderStatus, Repartidor } from '~/types/orders'
import type { SiigoCustomer } from '~/types/siigo'

const props = defineProps<{
  customers: SiigoCustomer[]
  statuses: OrderStatus[]
  repartidores: Repartidor[]
  loading: boolean
  disabled: boolean
}>()

const customerId = defineModel<string>('customerId', { required: true })
const statusKey = defineModel<string>('statusKey', { required: true })
const repartidorId = defineModel<string>('repartidorId', { required: true })
const orderDate = defineModel<string>('orderDate', { required: true })
const promisedDate = defineModel<string>('promisedDate', { required: true })
const remision = defineModel<string>('remision', { required: true })
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

      <UFormField name="remision" label="Remisión física">
        <UInput
          v-model="remision"
          :disabled="disabled"
          maxlength="100"
          placeholder="Número de remisión"
          class="w-full"
        />
      </UFormField>

      <UFormField
        name="repartidorId"
        label="Repartidor"
        required
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
