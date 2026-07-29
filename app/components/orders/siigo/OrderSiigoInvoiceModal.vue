<script setup lang="ts">
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

const schema = z.object({
  documentTypeId: z.number().int().positive('Selecciona un tipo de factura.'),
  invoiceNumber: z.number().int().positive().optional(),
  sellerId: z.number().int().positive('Selecciona un vendedor.'),
  paymentTypeId: z.number().int().positive('Selecciona una condición de pago.'),
  costCenterId: z.number().int().positive().optional(),
  warehouseId: z.number().int().positive().optional(),
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
  warehouseId: undefined,
  useCfdi: 'G03',
  paymentMethod: 'PUE',
  date: new Date().toISOString().slice(0, 10),
  dueDate: new Date().toISOString().slice(0, 10),
  confirmed: false
})

const documentItems = computed(() => props.context.documentTypes.map(item => ({
  label: `${item.name} (${item.code})`,
  value: item.id
})))
const sellerItems = computed(() => props.context.sellers.map(item => ({
  label: item.name,
  description: item.email || undefined,
  value: item.id
})))
const paymentItems = computed(() => props.context.paymentTypes.map(item => ({
  label: item.name,
  value: item.id
})))
const costCenterItems = computed(() => props.context.costCenters.map(item => ({
  label: item.name,
  value: item.id
})))
const warehouseItems = computed(() => props.context.warehouses.map(item => ({
  label: item.name,
  value: item.id
})))
const selectedDocument = computed(() =>
  props.context.documentTypes.find(item => item.id === state.documentTypeId)
)
const manualNumber = computed(() => selectedDocument.value?.automatic_number === false)
const requiresCostCenter = computed(() => Boolean(selectedDocument.value?.cost_center_mandatory))

function resetState() {
  const document = props.context.documentTypes[0]
  state.documentTypeId = document?.id
  state.invoiceNumber = document?.automatic_number === false ? document.consecutive : undefined
  state.sellerId = props.context.sellers[0]?.id
  state.paymentTypeId = props.context.paymentTypes[0]?.id
  state.costCenterId = document?.cost_center_default ?? undefined
  state.warehouseId = undefined
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
    warehouseId: event.data.warehouseId,
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
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UAlert
        class="mb-5"
        color="warning"
        variant="subtle"
        icon="i-lucide-file-warning"
        title="Esta acción sí crea una factura de venta"
        description="Quedará en estado Draft dentro de Siigo. El timbrado seguirá siendo una acción distinta."
      />

      <UForm
        id="siigo-invoice-form"
        :schema="schema"
        :state="state"
        class="grid gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UFormField name="documentTypeId" label="Tipo de factura" required>
          <USelect
            v-model="state.documentTypeId"
            :items="documentItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="manualNumber"
          name="invoiceNumber"
          label="Consecutivo"
          required
        >
          <UInputNumber v-model="state.invoiceNumber" :min="1" class="w-full" />
        </UFormField>

        <UFormField name="sellerId" label="Vendedor en Siigo" required>
          <USelectMenu
            v-model="state.sellerId"
            :items="sellerItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          name="useCfdi"
          label="Uso CFDI"
          description="Código SAT, por ejemplo G03."
          required
        >
          <UInput v-model="state.useCfdi" class="w-full" />
        </UFormField>

        <UFormField name="paymentMethod" label="Método de pago" required>
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

        <UFormField name="paymentTypeId" label="Condición de pago" required>
          <USelect
            v-model="state.paymentTypeId"
            :items="paymentItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="date" label="Fecha de factura" required>
          <UInput v-model="state.date" type="date" class="w-full" />
        </UFormField>

        <UFormField name="dueDate" label="Fecha de vencimiento" required>
          <UInput v-model="state.dueDate" type="date" class="w-full" />
        </UFormField>

        <UFormField
          v-if="selectedDocument?.cost_center"
          name="costCenterId"
          label="Centro de costo"
          :required="requiresCostCenter"
        >
          <USelect
            v-model="state.costCenterId"
            :items="costCenterItems"
            value-key="value"
            placeholder="Sin centro de costo"
            class="w-full"
          />
        </UFormField>

        <UFormField name="warehouseId" label="Bodega" hint="Opcional">
          <USelect
            v-model="state.warehouseId"
            :items="warehouseItems"
            value-key="value"
            placeholder="Usar configuración de Siigo"
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
