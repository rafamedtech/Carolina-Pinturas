<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { SalesOrderDetail } from '~/types/orders'
import type {
  AssignHistoricalSiigoInvoiceInput,
  HistoricalSiigoInvoiceContext
} from '~/types/siigo-invoices'

const props = defineProps<{
  orderId: string
}>()
const emit = defineEmits<{
  assigned: [order: SalesOrderDetail]
}>()
const open = defineModel<boolean>('open', { required: true })
const saving = shallowRef(false)
const toast = useToast()
const {
  data: context,
  error,
  status,
  refresh
} = useFetch<HistoricalSiigoInvoiceContext>(
  () => `/api/orders/${encodeURIComponent(props.orderId)}/siigo-invoice/legacy-context`,
  { immediate: false }
)
const schema = z.object({
  invoiceId: z.string().uuid('Selecciona una factura.'),
  confirmed: z.boolean().refine(value => value, 'Confirma la asignación de la factura.')
})
type Schema = z.output<typeof schema>
const state = reactive<Partial<Schema>>({ invoiceId: '', confirmed: false })
const invoiceItems = computed(() => (context.value?.invoices || []).map(invoice => ({
  label: invoice.name,
  description: `${formatDate(invoice.date)} · ${formatCurrency(invoice.total)} · Timbrada`,
  value: invoice.id
})))

watch(open, async (isOpen) => {
  if (!isOpen) return
  state.invoiceId = ''
  state.confirmed = false
  await refresh()
  state.invoiceId = context.value?.invoices[0]?.id || ''
})

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
}

function formatDate(value: string) {
  return value.split('-').reverse().join('/')
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (saving.value) return
  saving.value = true
  const input: AssignHistoricalSiigoInvoiceInput = {
    invoiceId: event.data.invoiceId,
    confirmation: 'ASIGNAR_FACTURA_HISTORICA'
  }

  try {
    const order = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/siigo-invoice/legacy-assignment`,
      { method: 'POST', body: input }
    )
    open.value = false
    emit('assigned', order)
    toast.add({
      title: 'Factura histórica asignada',
      description: context.value?.invoices.find(invoice => invoice.id === input.invoiceId)?.name,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo asignar la factura',
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
    title="Asignar factura histórica"
    description="Herramienta temporal para pedidos facturados previamente en Siigo. Solo muestra facturas timbradas del mismo cliente y total."
    :dismissible="!saving"
    :ui="{ content: 'max-w-xl', footer: 'justify-end' }"
  >
    <template #body>
      <div v-if="status === 'pending'" class="space-y-3">
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-10 w-full" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        title="No se pudieron consultar las facturas"
        :description="error.data?.statusMessage || error.message"
      />

      <UAlert
        v-else-if="context && !context.invoices.length"
        color="warning"
        variant="subtle"
        title="Sin facturas compatibles"
        description="No hay facturas timbradas de este cliente cuyo total coincida con el pedido."
      />

      <UForm
        v-else-if="context"
        id="historical-invoice-form"
        :schema="schema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="rounded-lg bg-elevated p-3 text-sm">
          <p class="text-muted">
            {{ context.customerName }} · {{ context.orderNumber }}
          </p>
          <p class="mt-1 font-semibold">
            Total del pedido: {{ formatCurrency(context.orderTotal) }}
          </p>
        </div>

        <UFormField name="invoiceId" label="Factura timbrada de Siigo" required>
          <USelectMenu
            v-model="state.invoiceId"
            :items="invoiceItems"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField name="confirmed">
          <UCheckbox
            v-model="state.confirmed"
            label="Confirmo que esta factura corresponde al pedido y que la asociación no podrá reemplazarse."
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
        form="historical-invoice-form"
        label="Asignar factura"
        icon="i-lucide-link"
        :loading="saving"
        :disabled="saving || status === 'pending' || !context?.invoices.length"
      />
    </template>
  </UModal>
</template>
