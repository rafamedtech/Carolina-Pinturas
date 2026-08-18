<script setup lang="ts">
import type { SiigoCustomer, SiigoCustomerMutationInput } from '~/types/siigo'

defineProps<{
  customer: SiigoCustomer
  missingFields: string[]
  saving: boolean
  errorMessage: string
}>()

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  submit: [input: SiigoCustomerMutationInput]
}>()
</script>

<template>
  <UModal
    v-model:open="open"
    title="Completar datos para facturar"
    description="Estos datos se guardarán en Siigo y PostgreSQL antes de continuar con la factura."
    scrollable
    :dismissible="!saving"
    :close="saving ? false : undefined"
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <CustomersCustomerEditForm
        :customer="customer"
        :saving="saving"
        :error-message="errorMessage"
        :notice="`Completa: ${missingFields.join(', ')}.`"
        invoice-mode
        @submit="emit('submit', $event)"
        @cancel="open = false"
      />
    </template>
  </UModal>
</template>
