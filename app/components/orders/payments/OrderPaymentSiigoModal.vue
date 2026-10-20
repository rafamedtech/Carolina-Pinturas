<script setup lang="ts">
import { formatDate, mexicoToday } from '~/utils/datetime'
import { siigoReceiptPaymentDateError } from '#shared/utils/siigoReceiptDates'
import { SIIGO_PAYMENT_METHODS, paymentMethodCfdiCode } from '~/utils/orderPayment'
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
const resumingStamp = computed(() => Boolean(props.payment.siigo?.voucherId))

const schema = z.object({
  paymentDate: z.iso.date('Revisa la fecha en que recibiste el pago.'),
  invoiceId: z.string().uuid('Selecciona una factura.'),
  documentTypeId: z.number().int().positive('Selecciona el tipo de recepción.'),
  voucherNumber: z.number().int().positive().optional(),
  paymentTypeId: z.number().int().positive('Selecciona la condición de pago.'),
  costCenterId: z.number().int().positive().optional(),
  cfdiCode: z.string().min(1, 'Selecciona la forma de pago CFDI.'),
  paymentMethod: z.enum(['PUE', 'PPD']),
  quote: z.number().int().positive(),
  confirmed: z.boolean().refine(value => value, 'Confirma la creación en Siigo.')
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  paymentDate: props.payment.paymentDate,
  invoiceId: '',
  documentTypeId: undefined,
  voucherNumber: undefined,
  paymentTypeId: undefined,
  costCenterId: undefined,
  cfdiCode: '',
  paymentMethod: 'PPD',
  quote: 1,
  confirmed: false
})
const paymentDateError = computed(() => props.stampAfterCreate && !resumingStamp.value
  ? siigoReceiptPaymentDateError(props.payment.paymentDate)
  : null)
const stampRequestDate = computed(() => mexicoToday())
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
const receiptPaymentTypes = computed(() => props.context.siigo.paymentTypes.filter(payment => payment.active && !payment.due_date))
const paymentTypeItems = computed(() => receiptPaymentTypes.value.map(payment => ({
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
  && receiptPaymentTypes.value.length > 0
)
const cfdiItems = [
  ...SIIGO_PAYMENT_METHODS.map(method => ({ label: `${method.cfdiCode} · ${method.label}`, value: method.cfdiCode })),
  { label: '99 · Por definir', value: '99' }
]
const siigoMethodItems = [
  { label: 'PUE · Una exhibición', value: 'PUE' },
  { label: 'PPD · Parcialidades o diferido', value: 'PPD' }
]

function localCfdiCode() {
  // El registro local "tarjeta" no distingue crédito y débito: exigir selección.
  if (props.payment.paymentMethod === 'tarjeta') return ''
  return paymentMethodCfdiCode(props.payment.paymentMethod) ?? '99'
}

function defaultPaymentTypeId(cfdiCode: string) {
  if (!cfdiCode) return undefined
  return receiptPaymentTypes.value.find(payment =>
    payment.name.trim().startsWith(cfdiCode)
  )?.id ?? receiptPaymentTypes.value[0]?.id
}

function nextQuote(invoiceId: string) {
  const previousQuotes = props.context.payments.flatMap(payment =>
    payment.id !== props.payment.id
    && payment.siigo?.invoiceId === invoiceId
    && (payment.externalStatus !== 'failed' || payment.siigo.voucherId)
      ? [payment.siigo.quote]
      : []
  )
  return Math.max(0, ...previousQuotes) + 1
}

watch(() => state.cfdiCode, (code) => {
  if (resumingStamp.value || !code) return
  const matching = receiptPaymentTypes.value.find(payment => payment.name.trim().startsWith(`${code} `))
  if (matching) state.paymentTypeId = matching.id
})

watch(open, (isOpen) => {
  if (!isOpen) return
  state.invoiceId = props.context.siigo.assignedInvoice?.id || ''
  state.documentTypeId = props.payment.siigo?.documentTypeId || props.context.siigo.documentTypes[0]?.id
  state.cfdiCode = props.payment.siigo?.cfdiCode || localCfdiCode()
  const previousPaymentType = receiptPaymentTypes.value.find(payment => payment.id === props.payment.siigo?.paymentTypeId)
  state.paymentTypeId = previousPaymentType?.id || defaultPaymentTypeId(state.cfdiCode)
  state.costCenterId = props.payment.siigo?.costCenterId ?? undefined
  state.paymentMethod = resumingStamp.value
    ? props.payment.siigo?.paymentMethod || 'PPD'
    : props.stampAfterCreate ? 'PPD' : props.payment.siigo?.paymentMethod || 'PPD'
  state.quote = props.payment.siigo?.quote || nextQuote(state.invoiceId)
  state.paymentDate = props.payment.paymentDate
  state.confirmed = false
}, { immediate: true })

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
}

function onSubmit(event: FormSubmitEvent<Schema>) {
  emit('submit', {
    paymentDate: event.data.paymentDate,
    invoiceId: event.data.invoiceId,
    documentTypeId: event.data.documentTypeId,
    voucherNumber: event.data.voucherNumber,
    paymentTypeId: event.data.paymentTypeId,
    costCenterId: event.data.costCenterId,
    cfdiCode: event.data.cfdiCode,
    paymentMethod: event.data.paymentMethod,
    quote: event.data.quote,
    stamp: props.stampAfterCreate || undefined,
    confirmation: props.stampAfterCreate
      ? resumingStamp.value ? 'TIMBRAR_RECEPCION_SIIGO' : 'CREAR_Y_TIMBRAR_RECEPCION_SIIGO'
      : 'CREAR_RECEPCION_SIIGO'
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="resumingStamp ? 'Timbrar recepción existente' : stampAfterCreate ? 'Crear y timbrar pago en Siigo' : 'Registrar pago en Siigo'"
    :description="stampAfterCreate
      ? resumingStamp
        ? 'Revisará la recepción existente y solicitará su timbrado conservando la fecha real del pago.'
        : 'Creará una recepción para este pago y solicitará su timbrado ante el SAT. Esta operación fiscal no se puede deshacer desde la aplicación.'
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
          v-if="paymentDateError"
          class="sm:col-span-2"
          color="warning"
          variant="subtle"
          title="Conserva la fecha real del pago"
          :description="paymentDateError"
        >
          <template #actions>
            <UButton
              label="Abrir Siigo Nube"
              to="https://siigonube.siigo.mx/"
              target="_blank"
              color="neutral"
              variant="outline"
              icon="i-lucide-external-link"
            />
          </template>
        </UAlert>
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
              Fecha en que recibiste el pago
            </p>
            <p class="font-semibold">
              {{ formatDate(payment.paymentDate) }}
            </p>
          </div>
        </div>

        <p v-if="stampAfterCreate" class="sm:col-span-2 text-sm text-muted">
          El timbrado se solicitará hoy, {{ formatDate(stampRequestDate) }}. La fecha del pago es la que capturaste al registrarlo y se conserva en Siigo; no se cambia por la fecha del timbrado.
        </p>
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
            :disabled="resumingStamp"
            :items="documentItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="needsVoucherNumber && !resumingStamp"
          name="voucherNumber"
          label="Consecutivo"
          required
        >
          <UInputNumber v-model="state.voucherNumber" :min="1" class="w-full" />
        </UFormField>
        <UFormField name="paymentTypeId" label="Condición de ingreso en Siigo" required>
          <USelect
            v-model="state.paymentTypeId"
            :disabled="resumingStamp"
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
            :disabled="resumingStamp"
            :items="costCenterItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField
          name="cfdiCode"
          label="Forma de pago CFDI"
          :description="payment.paymentMethod === 'tarjeta' ? 'Selecciona 04 para tarjeta de crédito o 28 para tarjeta de débito.' : undefined"
          required
        >
          <USelect
            v-model="state.cfdiCode"
            :disabled="resumingStamp"
            :items="cfdiItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField
          name="paymentMethod"
          label="Método de pago CFDI de la recepción"
          description="El complemento de una factura PPD usa PPD, incluso si este pago liquida todo el saldo."
          required
        >
          <USelect
            v-model="state.paymentMethod"
            :disabled="resumingStamp || stampAfterCreate"
            :items="siigoMethodItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField name="quote" label="Número de parcialidad" required>
          <UInputNumber
            v-model="state.quote"
            :min="1"
            :disabled="resumingStamp"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="stampAfterCreate"
          class="sm:col-span-2"
          label="Correo para la recepción timbrada"
          description="Se usará el correo del cliente consultado en Siigo. Para cambiarlo, actualiza sus contactos en Siigo."
        >
          <UInput
            :model-value="context.siigo.customerEmail || ''"
            readonly
            placeholder="El cliente necesita un correo válido en Siigo"
            class="w-full"
          />
        </UFormField>
        <UFormField class="sm:col-span-2" name="confirmed">
          <UCheckbox
            v-model="state.confirmed"
            :label="stampAfterCreate
              ? resumingStamp
                ? 'Confirmo que deseo timbrar esta recepción existente conservando la fecha real del pago.'
                : 'Confirmo que deseo crear y timbrar esta recepción en Siigo.'
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
        :label="resumingStamp ? 'Timbrar recepción' : stampAfterCreate ? 'Crear y timbrar' : 'Registrar en Siigo'"
        :icon="stampAfterCreate ? 'i-lucide-badge-check' : 'i-lucide-cloud-upload'"
        :loading="saving"
        :disabled="saving || !canUseSiigo || !context.siigo.writeEnabled || Boolean(paymentDateError) || (stampAfterCreate && !context.siigo.customerEmail)"
      />
    </template>
  </UModal>
</template>
