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
const validateProducts = shallowRef(false)
const {
  data: context,
  error: contextError,
  refresh
} = useFetch<OrderSiigoInvoiceContext>(
  () => `/api/orders/${encodeURIComponent(props.orderId)}/siigo-invoice/context`,
  {
    lazy: true,
    server: false,
    key: `order-siigo-invoice-${props.orderId}`,
    immediate: false,
    query: { validate_products: computed(() => validateProducts.value ? 'true' : undefined) },
    watch: false
  }
)

const hasExistingInvoice = computed(() => context.value?.invoice?.status === 'created')
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

  if (hasExistingInvoice.value) {
    open.value = false
    return
  }

  // The Facturar action explicitly validates only this order's products.
  checking.value = true
  validateProducts.value = true
  try {
    await refresh()
    emit('checked')
  } finally {
    validateProducts.value = false
    checking.value = false
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

  if (hasExistingInvoice.value) {
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
  if (saving.value || checking.value) return
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
    v-if="context && catalogsReady && !checking"
    v-model:open="open"
    :context="context"
    :saving="saving"
    @submit="createInvoice"
  />
</template>
