<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CreateOrderPaymentInput, OrderPaymentContext } from '~/types/siigo-payments'
import type { PaymentMethodKey } from '~/utils/orderPayment'
import { PAYMENT_METHOD_KEYS, PAYMENT_METHODS } from '~/utils/orderPayment'
import { mexicoToday } from '~/utils/datetime'

const props = defineProps<{
  context: OrderPaymentContext
  saving: boolean
}>()

const emit = defineEmits<{
  submit: [input: CreateOrderPaymentInput]
}>()

const open = defineModel<boolean>('open', { required: true })
const requestId = shallowRef('')
const schema = z.object({
  paymentMethod: z.enum(PAYMENT_METHOD_KEYS as [PaymentMethodKey, ...PaymentMethodKey[]]),
  amount: z.number().positive('Captura un importe mayor a cero.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Captura una fecha válida.'),
  reference: z.string().max(250),
  observations: z.string().max(2500)
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  paymentMethod: 'efectivo',
  amount: undefined,
  date: mexicoToday(),
  reference: '',
  observations: ''
})
const paymentDate = computed<DateValue | undefined>({
  get: () => state.date ? parseDate(state.date) : undefined,
  set: (value) => { state.date = value?.toString() ?? '' }
})
const methodItems = PAYMENT_METHODS.map(method => ({ label: method.label, value: method.key }))

watch(open, (isOpen) => {
  if (!isOpen) return
  requestId.value = crypto.randomUUID()
  state.paymentMethod = 'efectivo'
  state.amount = props.context.balance
  state.date = mexicoToday()
  state.reference = ''
  state.observations = ''
}, { immediate: true })

function onSubmit(event: FormSubmitEvent<Schema>) {
  emit('submit', {
    destination: 'local',
    requestId: requestId.value,
    paymentMethod: event.data.paymentMethod,
    amount: event.data.amount,
    date: event.data.date,
    reference: event.data.reference || null,
    observations: event.data.observations || null
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Agregar pago"
    description="Registra un abono o liquida el pedido. Si después se factura, podrás registrar este pago en Siigo."
    :ui="{ content: 'max-w-2xl', footer: 'justify-end' }"
  >
    <template #body>
      <UForm
        id="order-payment-form"
        :schema="schema"
        :state="state"
        class="grid gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UFormField name="paymentMethod" label="Método de pago" required>
          <USelect
            v-model="state.paymentMethod"
            :items="methodItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="amount" label="Importe" required>
          <UInputNumber
            v-model="state.amount"
            :min="0.01"
            :max="context.balance"
            :step="0.01"
            class="w-full"
          />
        </UFormField>

        <UFormField name="date" label="Fecha de pago" required>
          <OrdersOrderDatePicker
            v-model="paymentDate"
            :disabled="saving"
            placeholder="Seleccionar fecha de pago"
          />
        </UFormField>

        <UFormField name="reference" label="Referencia" hint="Opcional">
          <UInput v-model="state.reference" class="w-full" placeholder="Folio, transferencia o nota interna" />
        </UFormField>

        <UFormField
          class="sm:col-span-2"
          name="observations"
          label="Observaciones"
          hint="Opcional"
        >
          <UTextarea
            v-model="state.observations"
            :rows="3"
            autoresize
            :maxrows="6"
            class="w-full"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton
        label="Cancelar"
        color="neutral"
        variant="outline"
        @click="close"
      />
      <UButton
        type="submit"
        form="order-payment-form"
        label="Guardar pago"
        icon="i-lucide-hand-coins"
        :loading="saving"
        :disabled="saving"
      />
    </template>
  </UModal>
</template>
