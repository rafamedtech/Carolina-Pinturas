<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CreateOrderPaymentInput,
  OrderPaymentContext
} from '~/types/siigo-payments'
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
const isSiigo = computed(() => props.context.requiresInvoice)
const canUseSiigo = computed(() =>
  props.context.siigo.available
  && props.context.siigo.invoices.length > 0
  && props.context.siigo.documentTypes.length > 0
  && props.context.siigo.paymentTypes.length > 0
)

const schema = z.object({
  localPaymentMethod: z.enum(PAYMENT_METHOD_KEYS as [PaymentMethodKey, ...PaymentMethodKey[]]),
  invoiceId: z.string().optional(),
  documentTypeId: z.number().int().positive().optional(),
  voucherNumber: z.number().int().positive().optional(),
  paymentTypeId: z.number().int().positive().optional(),
  costCenterId: z.number().int().positive().optional(),
  cfdiCode: z.string().optional(),
  siigoPaymentMethod: z.enum(['PUE', 'PPD']).optional(),
  amount: z.number().positive('Captura un importe mayor a cero.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Captura una fecha válida.'),
  quote: z.number().int().positive(),
  reference: z.string().max(250),
  observations: z.string().max(2500),
  confirmed: z.boolean()
}).superRefine((value, context) => {
  if (!isSiigo.value) return
  const required: Array<[keyof typeof value, string]> = [
    ['invoiceId', 'Selecciona una factura.'],
    ['documentTypeId', 'Selecciona el tipo de recepción.'],
    ['paymentTypeId', 'Selecciona la condición de pago.'],
    ['cfdiCode', 'Selecciona la forma de pago CFDI.'],
    ['siigoPaymentMethod', 'Selecciona el método CFDI.']
  ]
  for (const [path, message] of required) {
    if (!value[path]) context.addIssue({ code: 'custom', path: [path], message })
  }
  if (!value.confirmed) {
    context.addIssue({ code: 'custom', path: ['confirmed'], message: 'Confirma la creación en Siigo.' })
  }
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  localPaymentMethod: 'efectivo',
  invoiceId: '',
  documentTypeId: undefined,
  voucherNumber: undefined,
  paymentTypeId: undefined,
  costCenterId: undefined,
  cfdiCode: '',
  siigoPaymentMethod: 'PUE',
  amount: undefined,
  date: mexicoToday(),
  quote: 1,
  reference: '',
  observations: '',
  confirmed: false
})

const methodItems = PAYMENT_METHODS.map(method => ({ label: method.label, value: method.key }))
const invoiceItems = computed(() => props.context.siigo.invoices.map(invoice => ({
  label: invoice.name,
  description: `Saldo ${formatCurrency(invoice.balance)} · ${formatDate(invoice.date)}`,
  value: invoice.id
})))
const documentItems = computed(() => props.context.siigo.documentTypes.map(document => ({
  label: `${document.code} · ${document.name}`,
  value: document.id
})))
const paymentTypeItems = computed(() => props.context.siigo.paymentTypes.map(payment => ({
  label: payment.name,
  description: payment.type,
  value: payment.id
})))
const costCenterItems = computed(() => props.context.siigo.costCenters.map(center => ({
  label: center.name,
  value: center.id
})))
const cfdiItems = [
  { label: '01 · Efectivo', value: '01' },
  { label: '02 · Cheque nominativo', value: '02' },
  { label: '03 · Transferencia electrónica', value: '03' },
  { label: '04 · Tarjeta de crédito', value: '04' },
  { label: '28 · Tarjeta de débito', value: '28' },
  { label: '99 · Por definir', value: '99' }
]
const siigoMethodItems = [
  { label: 'PUE · Una exhibición', value: 'PUE' },
  { label: 'PPD · Parcialidades o diferido', value: 'PPD' }
]
const selectedInvoice = computed(() =>
  props.context.siigo.invoices.find(invoice => invoice.id === state.invoiceId)
)
const selectedDocument = computed(() =>
  props.context.siigo.documentTypes.find(document => document.id === state.documentTypeId)
)
const needsVoucherNumber = computed(() => selectedDocument.value?.automatic_number === false)
const needsCostCenter = computed(() => selectedDocument.value?.cost_center_mandatory === true)
const maxAmount = computed(() =>
  Math.min(props.context.balance, selectedInvoice.value?.balance ?? props.context.balance)
)
const submitLabel = computed(() => isSiigo.value ? 'Guardar y crear en Siigo' : 'Guardar pago')
const modalDescription = computed(() => isSiigo.value
  ? 'Guarda el pago en PostgreSQL y crea la recepción vinculada con la factura de Siigo.'
  : 'Guarda el pago del pedido en PostgreSQL.'
)
const siigoUnavailableDescription = computed(() => {
  if (props.context.siigo.unavailableReason) return props.context.siigo.unavailableReason
  if (!props.context.siigo.invoices.length) {
    return 'El pedido todavía no tiene una factura con saldo disponible en Siigo.'
  }
  if (!props.context.siigo.documentTypes.length || !props.context.siigo.paymentTypes.length) {
    return 'Faltan catálogos de Siigo necesarios para crear la recepción.'
  }
  return 'Siigo no está disponible para registrar la recepción.'
})

watch(open, (isOpen) => {
  if (!isOpen) return
  requestId.value = crypto.randomUUID()
  state.localPaymentMethod = 'efectivo'
  state.invoiceId = props.context.siigo.invoices[0]?.id || ''
  state.documentTypeId = props.context.siigo.documentTypes[0]?.id
  state.paymentTypeId = props.context.siigo.paymentTypes[0]?.id
  state.costCenterId = undefined
  state.cfdiCode = ''
  state.siigoPaymentMethod = 'PUE'
  state.amount = props.context.balance
  state.date = mexicoToday()
  state.quote = 1
  state.reference = ''
  state.observations = ''
  state.confirmed = false
}, { immediate: true })

watch(selectedInvoice, (invoice) => {
  if (invoice && isSiigo.value) state.amount = Math.min(invoice.balance, props.context.balance)
})

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value)
}

function formatDate(value: string) {
  return value.split('-').reverse().join('/')
}

function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!isSiigo.value) {
    emit('submit', {
      destination: 'local',
      requestId: requestId.value,
      paymentMethod: event.data.localPaymentMethod,
      amount: event.data.amount,
      date: event.data.date,
      reference: event.data.reference || null,
      observations: event.data.observations || null
    })
    return
  }

  emit('submit', {
    destination: 'siigo',
    requestId: requestId.value,
    invoiceId: event.data.invoiceId!,
    documentTypeId: event.data.documentTypeId!,
    voucherNumber: event.data.voucherNumber,
    paymentTypeId: event.data.paymentTypeId!,
    costCenterId: event.data.costCenterId,
    cfdiCode: event.data.cfdiCode!,
    paymentMethod: event.data.siigoPaymentMethod!,
    amount: event.data.amount,
    date: event.data.date,
    quote: event.data.quote,
    observations: event.data.observations || null,
    confirmation: 'CREAR_RECEPCION_SIIGO'
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Agregar pago"
    :description="modalDescription"
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
        <UAlert
          v-if="isSiigo && !canUseSiigo"
          class="sm:col-span-2"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="No se puede registrar el pago"
          :description="siigoUnavailableDescription"
        />

        <UAlert
          v-else-if="isSiigo && !context.siigo.writeEnabled"
          class="sm:col-span-2"
          color="warning"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="Escritura fiscal deshabilitada"
          description="No se registrará el pago hasta que la creación de recepciones esté habilitada en Siigo."
        />

        <UFormField
          v-if="!isSiigo"
          name="localPaymentMethod"
          label="Método de pago"
          required
        >
          <USelect
            v-model="state.localPaymentMethod"
            :items="methodItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <template v-else>
          <UFormField
            class="sm:col-span-2"
            name="invoiceId"
            label="Factura de Siigo"
            required
          >
            <USelect
              v-model="state.invoiceId"
              :items="invoiceItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField name="documentTypeId" label="Tipo de recepción" required>
            <USelect
              v-model="state.documentTypeId"
              :items="documentItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="needsVoucherNumber"
            name="voucherNumber"
            label="Consecutivo"
            required
          >
            <UInputNumber v-model="state.voucherNumber" :min="1" class="w-full" />
          </UFormField>

          <UFormField name="paymentTypeId" label="Condición de pago" required>
            <USelect
              v-model="state.paymentTypeId"
              :items="paymentTypeItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField
            v-if="selectedDocument?.cost_center"
            name="costCenterId"
            label="Centro de costo"
            :required="needsCostCenter"
          >
            <USelect
              v-model="state.costCenterId"
              :items="costCenterItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField name="cfdiCode" label="Forma de pago CFDI" required>
            <USelect
              v-model="state.cfdiCode"
              :items="cfdiItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField name="siigoPaymentMethod" label="Método CFDI" required>
            <USelect
              v-model="state.siigoPaymentMethod"
              :items="siigoMethodItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField name="quote" label="Número de parcialidad" required>
            <UInputNumber v-model="state.quote" :min="1" class="w-full" />
          </UFormField>
        </template>

        <UFormField name="amount" label="Importe" required>
          <UInputNumber
            v-model="state.amount"
            :min="0.01"
            :max="maxAmount"
            :step="0.01"
            class="w-full"
          />
        </UFormField>

        <UFormField name="date" label="Fecha de pago" required>
          <UInput v-model="state.date" type="date" class="w-full" />
        </UFormField>

        <UFormField
          v-if="!isSiigo"
          class="sm:col-span-2"
          name="reference"
          label="Referencia"
          hint="Opcional"
        >
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

        <UFormField v-if="isSiigo" class="sm:col-span-2" name="confirmed">
          <UCheckbox
            v-model="state.confirmed"
            label="Confirmo que deseo guardar el pago y crear una recepción fiscal en Siigo."
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
        :label="submitLabel"
        icon="i-lucide-hand-coins"
        :loading="saving"
        :disabled="saving || (isSiigo && (!canUseSiigo || !context.siigo.writeEnabled))"
      />
    </template>
  </UModal>
</template>
