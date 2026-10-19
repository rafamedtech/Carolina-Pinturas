<script setup lang="ts">
import { formatDate } from '~/utils/datetime'
import { SIIGO_NUBE_REGISTER_PAYMENT_URL } from '~/utils/siigoNube'
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type {
  AssignHistoricalSiigoReceiptInput,
  HistoricalSiigoReceiptContext,
  OrderPayment
} from '~/types/siigo-payments'

const props = defineProps<{
  orderId: string
  paymentId: string
  siigoUrl?: string
  reviewSiigoFirst?: boolean
}>()
const emit = defineEmits<{
  assigned: [payment: OrderPayment]
}>()
const open = defineModel<boolean>('open', { required: true })
const saving = shallowRef(false)
const loadingReceipts = shallowRef(true)
const toast = useToast()
const {
  data: context,
  error,
  refresh
} = useFetch<HistoricalSiigoReceiptContext>(
  () => `/api/orders/${encodeURIComponent(props.orderId)}/payments/${encodeURIComponent(props.paymentId)}/siigo-receipt/legacy-context`,
  { immediate: false }
)
const schema = z.object({
  voucherId: z.string().uuid('Selecciona una recepción.'),
  confirmed: z.boolean().refine(value => value, 'Confirma la asignación de la recepción.')
})
type Schema = z.output<typeof schema>
const state = reactive<Partial<Schema>>({ voucherId: '', confirmed: false })
const receiptItems = computed(() => (context.value?.receipts || []).map(receipt => ({
  label: receipt.name,
  description: `${formatDate(receipt.date)} · ${formatCurrency(receipt.amount)} · Parcialidad ${receipt.quote}`,
  value: receipt.id
})))
const selectedReceiptItem = computed(() => receiptItems.value.find(item => item.value === state.voucherId))

watch(open, async (isOpen) => {
  if (!isOpen) return
  loadingReceipts.value = true
  state.voucherId = ''
  state.confirmed = false
  try {
    await refresh()
    state.voucherId = context.value?.receipts[0]?.id || ''
  } finally {
    loadingReceipts.value = false
  }
}, { immediate: true, flush: 'sync' })

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (saving.value) return
  saving.value = true
  const input: AssignHistoricalSiigoReceiptInput = {
    voucherId: event.data.voucherId,
    confirmation: 'ASIGNAR_RECEPCION_HISTORICA'
  }

  try {
    const payment = await $fetch<OrderPayment>(
      `/api/orders/${encodeURIComponent(props.orderId)}/payments/${encodeURIComponent(props.paymentId)}/siigo-receipt/legacy-assignment`,
      { method: 'POST', body: input }
    )
    open.value = false
    emit('assigned', payment)
    toast.add({
      title: 'Pago de Siigo asignado',
      description: context.value?.receipts.find(receipt => receipt.id === input.voucherId)?.name,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo asignar el pago de Siigo',
      description: response.data?.statusMessage || response.message || 'Actualiza e intenta nuevamente.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
      duration: 8000
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Asignar pago existente de Siigo"
    description="Busca recepciones ya creadas para la factura de este pedido. La asignación sólo vincula registros; no crea ni modifica documentos en Siigo."
    :dismissible="!saving"
    :ui="{ content: 'max-w-xl', footer: 'justify-end' }"
  >
    <template #body>
      <div
        v-if="loadingReceipts"
        role="status"
        aria-live="polite"
        class="space-y-3"
      >
        <p class="text-sm text-muted">
          Cargando recepciones de pago de Siigo…
        </p>
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-10 w-full" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        title="No se pudieron consultar los pagos de Siigo"
        :description="error.data?.statusMessage || error.message"
      />

      <div v-if="!loadingReceipts && !error && context" class="mb-4 rounded-lg bg-elevated p-3 text-sm">
        <p class="text-muted">
          Factura {{ context.invoiceName }}
        </p>
        <p class="mt-1 font-semibold">
          Pago local: {{ formatCurrency(context.paymentAmount) }} · {{ formatDate(context.paymentDate) }}
        </p>
      </div>

      <UAlert
        v-if="!loadingReceipts && !error && context && !context.receipts.length"
        color="warning"
        variant="subtle"
        title="Sin pagos compatibles"
        description="No hay recepciones de esta factura cuyo cliente, fecha e importe coincidan con el pago local."
      />

      <p v-if="!loadingReceipts && !error && context && !context.receipts.length" class="mt-3 text-sm text-muted">
        {{ reviewSiigoFirst ? 'Revisa primero si la recepción ya existe en Siigo Nube para evitar duplicarla.' : 'Registra y timbra la recepción en Siigo Nube seleccionando la factura de este pedido.' }}
        Después vuelve a abrir «Asignar pago de Siigo» para vincularla aquí.
      </p>

      <UForm
        v-if="!loadingReceipts && !error && context?.receipts.length"
        id="historical-receipt-form"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField name="voucherId" label="Recepción de pago de Siigo" required>
          <USelectMenu
            v-model="state.voucherId"
            :items="receiptItems"
            value-key="value"
            label-key="label"
            description-key="description"
            placeholder="Selecciona un pago aplicado a la factura"
            class="w-full"
          >
            <template #default="{ modelValue }">
              <div v-if="modelValue" class="min-w-0 text-left">
                <p class="truncate font-medium">
                  {{ selectedReceiptItem?.label }}
                </p>
                <p class="truncate text-xs text-muted">
                  {{ selectedReceiptItem?.description }}
                </p>
              </div>
              <span v-else class="text-dimmed">Selecciona un pago aplicado a la factura</span>
            </template>
          </USelectMenu>
        </UFormField>

        <UFormField name="confirmed">
          <UCheckbox
            v-model="state.confirmed"
            label="Confirmo que esta recepción corresponde al pago local y que no se creará un documento nuevo en Siigo."
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
        v-if="!loadingReceipts && !error && context && !context.receipts.length"
        :label="reviewSiigoFirst ? 'Revisar en Siigo Nube' : 'Registrar pago en Siigo Nube'"
        :to="siigoUrl || SIIGO_NUBE_REGISTER_PAYMENT_URL"
        target="_blank"
        rel="noopener noreferrer"
        icon="i-lucide-external-link"
        :disabled="saving"
      />
      <UButton
        v-else-if="!loadingReceipts && !error && context?.receipts.length"
        type="submit"
        form="historical-receipt-form"
        label="Asignar pago"
        icon="i-lucide-link"
        :loading="saving"
        :disabled="saving || !state.voucherId"
      />
    </template>
  </UModal>
</template>
