<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CreateOrderSiigoReceiptInput,
  OrderPayment,
  OrderPaymentContext
} from '~/types/siigo-payments'

const props = defineProps<{
  context: OrderPaymentContext
  payment: OrderPayment
  saving: boolean
  stampAfterCreate?: boolean
}>()
const emit = defineEmits<{
  submit: [input: CreateOrderSiigoReceiptInput]
}>()
const open = defineModel<boolean>('open', { required: true })

const schema = z.object({
  invoiceId: z.string().uuid('Selecciona una factura.'),
  documentTypeId: z.number().int().positive('Selecciona el tipo de recepción.'),
  voucherNumber: z.number().int().positive().optional(),
  paymentTypeId: z.number().int().positive('Selecciona la condición de pago.'),
  costCenterId: z.number().int().positive().optional(),
  cfdiCode: z.string().min(1, 'Selecciona la forma de pago CFDI.'),
  paymentMethod: z.enum(['PUE', 'PPD']),
  quote: z.number().int().positive(),
  stampEmail: z.preprocess(
    value => value === '' ? undefined : value,
    z.string().trim().email('Escribe un correo válido.').max(100).optional()
  ),
  confirmed: z.boolean().refine(value => value, 'Confirma la creación en Siigo.')
}).superRefine((input, context) => {
  if (props.stampAfterCreate && !input.stampEmail) {
    context.addIssue({
      code: 'custom',
      path: ['stampEmail'],
      message: 'Escribe el correo al que Siigo enviará la recepción timbrada.'
    })
  }
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  invoiceId: '',
  documentTypeId: undefined,
  voucherNumber: undefined,
  paymentTypeId: undefined,
  costCenterId: undefined,
  cfdiCode: '',
  paymentMethod: 'PUE',
  quote: 1,
  stampEmail: '',
  confirmed: false
})
const invoiceItems = computed(() => props.context.siigo.assignedInvoice
  ? [{
      label: props.context.siigo.assignedInvoice.name,
      description: `Saldo ${formatCurrency(props.context.siigo.assignedInvoice.balance)} · ${formatDate(props.context.siigo.assignedInvoice.date)}`,
      value: props.context.siigo.assignedInvoice.id
    }]
  : [])
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
const selectedDocument = computed(() =>
  props.context.siigo.documentTypes.find(document => document.id === state.documentTypeId)
)
const selectedInvoice = computed(() =>
  props.context.siigo.assignedInvoice?.id === state.invoiceId
    ? props.context.siigo.assignedInvoice
    : null
)
const needsVoucherNumber = computed(() => selectedDocument.value?.automatic_number === false)
const needsCostCenter = computed(() => selectedDocument.value?.cost_center_mandatory === true)
const canUseSiigo = computed(() =>
  props.context.siigo.available
  && selectedInvoice.value?.stamped === true
  && props.context.siigo.documentTypes.length > 0
  && props.context.siigo.paymentTypes.length > 0
)
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

function localCfdiCode() {
  if (props.payment.paymentMethod === 'efectivo') return '01'
  if (props.payment.paymentMethod === 'cheque') return '02'
  if (props.payment.paymentMethod === 'transferencia') return '03'
  if (props.payment.paymentMethod === 'tarjeta') return '28'
  return '99'
}

function defaultPaymentTypeId(cfdiCode: string) {
  return props.context.siigo.paymentTypes.find(payment =>
    payment.name.trim().startsWith(cfdiCode)
  )?.id ?? props.context.siigo.paymentTypes[0]?.id
}

function nextQuote(invoiceId: string) {
  const previousQuotes = props.context.payments.flatMap(payment =>
    payment.id !== props.payment.id
    && payment.siigo?.invoiceId === invoiceId
    && payment.externalStatus !== 'failed'
      ? [payment.siigo.quote]
      : []
  )
  return Math.max(0, ...previousQuotes) + 1
}

watch(open, (isOpen) => {
  if (!isOpen) return
  state.invoiceId = props.context.siigo.assignedInvoice?.id || ''
  state.documentTypeId = props.context.siigo.documentTypes[0]?.id
  state.cfdiCode = props.payment.siigo?.cfdiCode || localCfdiCode()
  state.paymentTypeId = props.payment.siigo?.paymentTypeId || defaultPaymentTypeId(state.cfdiCode)
  state.costCenterId = undefined
  state.paymentMethod = 'PUE'
  state.quote = props.payment.siigo?.quote || nextQuote(state.invoiceId)
  state.stampEmail = ''
  state.confirmed = false
}, { immediate: true })

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
}

function formatDate(value: string) {
  return value.split('-').reverse().join('/')
}

function onSubmit(event: FormSubmitEvent<Schema>) {
  emit('submit', {
    invoiceId: event.data.invoiceId,
    documentTypeId: event.data.documentTypeId,
    voucherNumber: event.data.voucherNumber,
    paymentTypeId: event.data.paymentTypeId,
    costCenterId: event.data.costCenterId,
    cfdiCode: event.data.cfdiCode,
    paymentMethod: event.data.paymentMethod,
    quote: event.data.quote,
    stamp: props.stampAfterCreate || undefined,
    stampEmail: props.stampAfterCreate ? event.data.stampEmail : undefined,
    confirmation: props.stampAfterCreate
      ? 'CREAR_Y_TIMBRAR_RECEPCION_SIIGO'
      : 'CREAR_RECEPCION_SIIGO'
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="stampAfterCreate ? 'Crear y timbrar pago en Siigo' : 'Registrar pago en Siigo'"
    :description="stampAfterCreate
      ? 'Creará una recepción para este pago y la timbrará ante el SAT. Esta operación fiscal no se puede deshacer desde la aplicación.'
      : 'Creará una recepción borrador para este pago. No se timbrará ni enviará al SAT.'"
    :dismissible="!saving"
    :ui="{ content: 'max-w-2xl', footer: 'justify-end' }"
  >
    <template #body>
      <UForm
        id="siigo-payment-form"
        :schema="schema"
        :state="state"
        class="grid gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UAlert
          v-if="!canUseSiigo"
          class="sm:col-span-2"
          color="error"
          variant="subtle"
          title="No se puede registrar en Siigo"
          :description="context.siigo.unavailableReason || 'Falta la factura o algún catálogo necesario.'"
        />
        <UAlert
          v-else-if="!context.siigo.writeEnabled"
          class="sm:col-span-2"
          color="warning"
          variant="subtle"
          title="Escritura fiscal deshabilitada"
          description="La recepción no se creará hasta que esta operación sea autorizada."
        />

        <div class="sm:col-span-2 grid grid-cols-2 gap-3 rounded-lg bg-elevated p-3 text-sm">
          <div>
            <p class="text-muted">
              Importe
            </p>
            <p class="font-semibold">
              {{ formatCurrency(payment.amount) }}
            </p>
          </div>
          <div>
            <p class="text-muted">
              Fecha del pago
            </p>
            <p class="font-semibold">
              {{ formatDate(payment.paymentDate) }}
            </p>
          </div>
        </div>

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
            disabled
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
        <UFormField name="paymentTypeId" label="Método de pago CFDI" required>
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
        <UFormField name="paymentMethod" label="Condición de pago" required>
          <USelect
            v-model="state.paymentMethod"
            :items="siigoMethodItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField name="quote" label="Número de parcialidad" required>
          <UInputNumber v-model="state.quote" :min="1" class="w-full" />
        </UFormField>
        <UFormField
          v-if="stampAfterCreate"
          class="sm:col-span-2"
          name="stampEmail"
          label="Correo para la recepción timbrada"
          required
        >
          <UInput
            v-model="state.stampEmail"
            type="email"
            autocomplete="email"
            placeholder="cliente@ejemplo.com"
            class="w-full"
          />
        </UFormField>
        <UFormField class="sm:col-span-2" name="confirmed">
          <UCheckbox
            v-model="state.confirmed"
            :label="stampAfterCreate
              ? 'Confirmo que deseo crear y timbrar esta recepción en Siigo.'
              : 'Confirmo que deseo crear una recepción borrador para este pago en Siigo.'"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer="{ close }">
      <UButton
        label="Cancelar"
        color="neutral"
        variant="outline"
        :disabled="saving"
        @click="close"
      />
      <UButton
        type="submit"
        form="siigo-payment-form"
        :label="stampAfterCreate ? 'Crear y timbrar' : 'Registrar en Siigo'"
        :icon="stampAfterCreate ? 'i-lucide-badge-check' : 'i-lucide-cloud-upload'"
        :loading="saving"
        :disabled="saving || !canUseSiigo || !context.siigo.writeEnabled"
      />
    </template>
  </UModal>
</template>
