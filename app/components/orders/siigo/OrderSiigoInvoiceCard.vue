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
  checked: []
}>()

const open = defineModel<boolean>('open', { default: false })
const checking = defineModel<boolean>('checking', { default: false })
const saving = shallowRef(false)
const toast = useToast()
const {
  data: context,
  error: contextError,
  refresh
} = useFetch<OrderSiigoInvoiceContext>(
  () => `/api/orders/${encodeURIComponent(props.orderId)}/siigo-invoice/context`,
  {
    key: `order-siigo-invoice-${props.orderId}`,
    immediate: false
  }
)

const catalogsReady = computed(() => Boolean(
  context.value?.documentTypes.length
  && context.value?.sellers.length
  && context.value?.paymentTypes.length
))

async function checkInvoice() {
  if (checking.value) return
  checking.value = true

  try {
    await refresh()
    emit('checked')

    if (contextError.value) {
      toast.add({
        title: 'No se pudo verificar la factura en Siigo',
        description: contextError.value.data?.statusMessage || contextError.value.message,
        color: 'error',
        icon: 'i-lucide-circle-alert'
      })
    }
  } finally {
    checking.value = false
  }
}

onMounted(checkInvoice)

watch(open, async (shouldOpen) => {
  if (!shouldOpen || checking.value) return

  // A pedido that was just marked for invoicing needs catalogs, but there was
  // no existing invoice to reconcile when the page-level check ran.
  if (context.value?.requiresInvoice === false) {
    checking.value = true
    try {
      await refresh()
      emit('checked')
    } finally {
      checking.value = false
    }
  }

  if (contextError.value) {
    open.value = false
    toast.add({
      title: 'No se pudo verificar la factura en Siigo',
      description: contextError.value.data?.statusMessage || contextError.value.message,
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
    return
  }

  if (context.value?.invoice?.status === 'created') {
    open.value = false
    return
  }

  if (context.value?.invoice && context.value.invoice.status !== 'failed') {
    open.value = false
    toast.add({
      title: 'La factura anterior requiere revisión',
      description: context.value.invoice.lastError || 'Verifica la factura en Siigo antes de intentar otra creación.',
      color: 'warning',
      icon: 'i-lucide-triangle-alert'
    })
    return
  }

  if (context.value?.customer && !context.value.customerReadyForInvoice) {
    open.value = false
    toast.add({
      title: 'El cliente no está listo para facturar',
      description: `Actualiza en Siigo: ${context.value.missingCustomerFields.join(', ')}. Después vuelve a intentarlo.`,
      color: 'warning',
      icon: 'i-lucide-triangle-alert'
    })
  }
})

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
