<script setup lang="ts">
import type {
  CreateOrderSiigoInvoiceInput,
  OrderSiigoInvoice,
  OrderSiigoInvoiceContext
} from '~/types/siigo-invoices'

const props = defineProps<{
  orderId: string
}>()

const emit = defineEmits<{
  created: [invoice: OrderSiigoInvoice]
}>()

const open = defineModel<boolean>('open', { default: false })
const saving = shallowRef(false)
const toast = useToast()
const {
  data: context,
  refresh
} = useFetch<OrderSiigoInvoiceContext>(
  () => `/api/orders/${encodeURIComponent(props.orderId)}/siigo-invoice/context`,
  {
    key: `order-siigo-invoice-${props.orderId}`,
    lazy: true
  }
)

const catalogsReady = computed(() => Boolean(
  context.value?.documentTypes.length
  && context.value?.sellers.length
  && context.value?.paymentTypes.length
))

async function createInvoice(input: CreateOrderSiigoInvoiceInput) {
  if (saving.value) return
  saving.value = true

  try {
    const invoice = await $fetch<OrderSiigoInvoice>(
      `/api/orders/${encodeURIComponent(props.orderId)}/siigo-invoice`,
      { method: 'POST', body: input }
    )
    open.value = false
    await refresh()
    emit('created', invoice)
    toast.add({
      title: 'Factura borrador creada en Siigo',
      description: invoice.siigoInvoiceName || invoice.siigoInvoiceId || undefined,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    await refresh()
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo confirmar la factura',
      description: response.data?.statusMessage || response.message || 'Verifica Siigo antes de volver a intentar.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
      duration: 9000
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <OrdersSiigoOrderSiigoInvoiceModal
    v-if="context && catalogsReady"
    v-model:open="open"
    :context="context"
    :saving="saving"
    @submit="createInvoice"
  />
</template>
