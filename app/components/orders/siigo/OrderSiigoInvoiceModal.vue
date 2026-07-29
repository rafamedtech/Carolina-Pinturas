<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  CreateOrderSiigoInvoiceInput,
  OrderSiigoInvoiceContext
} from '~/types/siigo-invoices'

const props = defineProps<{
  context: OrderSiigoInvoiceContext
  saving: boolean
}>()

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  submit: [input: CreateOrderSiigoInvoiceInput]
}>()

const useCfdiItems = [
  { label: 'G01 · Adquisición de mercancías', value: 'G01' },
  { label: 'G02 · Devoluciones, descuentos o bonificaciones', value: 'G02' },
  { label: 'G03 · Gastos en general', value: 'G03' },
  { label: 'I01 · Construcciones', value: 'I01' },
  { label: 'I02 · Mobiliario y equipo de oficina por inversiones', value: 'I02' },
  { label: 'I03 · Equipo de transporte', value: 'I03' },
  { label: 'I04 · Equipo de cómputo y accesorios', value: 'I04' },
  { label: 'I05 · Dados, troqueles, moldes, matrices y herramental', value: 'I05' },
  { label: 'I06 · Comunicaciones telefónicas', value: 'I06' },
  { label: 'I07 · Comunicaciones satelitales', value: 'I07' },
  { label: 'I08 · Otra maquinaria y equipo', value: 'I08' },
  { label: 'D01 · Honorarios médicos, dentales y gastos hospitalarios', value: 'D01' },
  { label: 'D02 · Gastos médicos por incapacidad o discapacidad', value: 'D02' },
  { label: 'D03 · Gastos funerales', value: 'D03' },
  { label: 'D04 · Donativos', value: 'D04' },
  { label: 'D05 · Intereses reales pagados por créditos hipotecarios', value: 'D05' },
  { label: 'D06 · Aportaciones voluntarias al SAR', value: 'D06' },
  { label: 'D07 · Primas por seguros de gastos médicos', value: 'D07' },
  { label: 'D08 · Gastos de transportación escolar obligatoria', value: 'D08' },
  { label: 'D09 · Depósitos en cuentas para el ahorro y planes de pensiones', value: 'D09' },
  { label: 'D10 · Pagos por servicios educativos (colegiaturas)', value: 'D10' },
  { label: 'P01 · Por definir', value: 'P01' },
  { label: 'S01 · Sin efectos fiscales', value: 'S01' },
  { label: 'CP01 · Pagos', value: 'CP01' },
  { label: 'CN01 · Nómina', value: 'CN01' }
]

const schema = z.object({
  documentTypeId: z.number().int().positive('Selecciona un tipo de factura.'),
  invoiceNumber: z.number().int().positive().optional(),
  sellerId: z.number().int().positive('Selecciona un vendedor.'),
  paymentTypeId: z.number().int().positive('Selecciona un método de pago.'),
  costCenterId: z.number().int().positive().optional(),
  useCfdi: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,8}$/, 'Captura un uso CFDI válido.'),
  paymentMethod: z.enum(['PUE', 'PPD']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona la fecha de factura.'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona la fecha de vencimiento.'),
  confirmed: z.boolean().refine(value => value, 'Confirma que deseas crear el borrador en Siigo.')
})

type Schema = z.output<typeof schema>
const state = reactive<Partial<Schema>>({
  documentTypeId: undefined,
  invoiceNumber: undefined,
  sellerId: undefined,
  paymentTypeId: undefined,
  costCenterId: undefined,
  useCfdi: 'G03',
  paymentMethod: 'PUE',
  date: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  confirmed: false
})

const sellerItems = computed(() => props.context.sellers.map(item => ({
  label: item.name,
  description: item.email || undefined,
  value: item.id
})))
const paymentItems = computed(() => [...props.context.paymentTypes]
  .sort((first, second) => first.id - second.id)
  .map(item => ({
    label: item.name,
    value: item.id
  })))
const defaultPaymentTypeId = computed(() =>
  props.context.paymentTypes.find(item => item.name.trim().toLocaleLowerCase('es-MX') === 'efectivo')?.id
  ?? paymentItems.value[0]?.value
)
const invoiceDate = computed<DateValue | undefined>({
  get: () => state.date ? parseDate(state.date) : undefined,
  set: (value) => { state.date = value?.toString() ?? '' }
})
const dueDate = computed<DateValue | undefined>({
  get: () => state.dueDate ? parseDate(state.dueDate) : undefined,
  set: (value) => { state.dueDate = value?.toString() ?? '' }
})
const selectedDocument = computed(() =>
  props.context.documentTypes.find(item => item.id === state.documentTypeId)
)
const manualNumber = computed(() => selectedDocument.value?.automatic_number === false)

function resetState() {
  const document = props.context.documentTypes[0]
  state.documentTypeId = document?.id
  state.invoiceNumber = document?.automatic_number === false ? document.consecutive : undefined
  state.sellerId = props.context.sellers[0]?.id
  state.paymentTypeId = defaultPaymentTypeId.value
  state.costCenterId = document?.cost_center_default ?? undefined
  state.useCfdi = 'G03'
  state.paymentMethod = 'PUE'
  state.date = new Date().toISOString().slice(0, 10)
  state.dueDate = state.date
  state.confirmed = false
}

watch(open, (value) => {
  if (value) resetState()
})

watch(selectedDocument, (document) => {
  state.invoiceNumber = document?.automatic_number === false ? document.consecutive : undefined
  state.costCenterId = document?.cost_center_default ?? undefined
})

watch(() => state.date, (date) => {
  if (date && (!state.dueDate || state.dueDate < date)) state.dueDate = date
})

function onSubmit(event: FormSubmitEvent<Schema>) {
  emit('submit', {
    documentTypeId: event.data.documentTypeId,
    invoiceNumber: event.data.invoiceNumber,
    sellerId: event.data.sellerId,
    paymentTypeId: event.data.paymentTypeId,
    costCenterId: event.data.costCenterId,
    useCfdi: event.data.useCfdi,
    paymentMethod: event.data.paymentMethod,
    date: event.data.date,
    dueDate: event.data.dueDate,
    confirmation: 'CREAR_BORRADOR_SIIGO'
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Crear factura borrador en Siigo"
    description="El documento se guardará sin timbrar y sin enviarse por correo."
    :dismissible="!saving"
    :ui="{ content: 'sm:max-w-[40rem]', footer: 'justify-end' }"
  >
    <template #body>
      <UForm
        id="siigo-invoice-form"
        :schema="schema"
        :state="state"
        class="grid gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UFormField name="date" label="Fecha de factura" required>
          <OrdersOrderDatePicker v-model="invoiceDate" />
        </UFormField>

        <UFormField name="dueDate" label="Fecha de vencimiento" required>
          <OrdersOrderDatePicker v-model="dueDate" />
        </UFormField>

        <UFormField
          v-if="manualNumber"
          name="invoiceNumber"
          label="Consecutivo"
          required
        >
          <UInputNumber v-model="state.invoiceNumber" :min="1" class="w-full" />
        </UFormField>

        <UFormField name="useCfdi" label="Uso CFDI" required>
          <USelectMenu
            v-model="state.useCfdi"
            :items="useCfdiItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="paymentTypeId" label="Método de pago" required>
          <USelectMenu
            v-model="state.paymentTypeId"
            :items="paymentItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="paymentMethod" label="Condición de pago" required>
          <USelect
            v-model="state.paymentMethod"
            :items="[
              { label: 'PUE · Una exhibición', value: 'PUE' },
              { label: 'PPD · Parcialidades o diferido', value: 'PPD' }
            ]"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="sellerId" label="Vendedor en Siigo" required>
          <USelectMenu
            v-model="state.sellerId"
            :items="sellerItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="confirmed" class="sm:col-span-2">
          <UCheckbox
            v-model="state.confirmed"
            label="Confirmo que deseo crear esta factura borrador en Siigo."
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
        form="siigo-invoice-form"
        label="Crear borrador"
        icon="i-lucide-file-plus-2"
        :loading="saving"
        :disabled="!context.writeEnabled"
      />
    </template>
  </UModal>
</template>
