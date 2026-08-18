<script setup lang="ts">
import type {
  CreateOrderSiigoInvoiceInput,
  OrderSiigoInvoice,
  OrderSiigoInvoiceContext
} from '~/types/siigo-invoices'
import type { SiigoCustomer, SiigoCustomerMutationInput } from '~/types/siigo'

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
const customerModalOpen = shallowRef(false)
const savingCustomer = shallowRef(false)
const customerError = shallowRef('')
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

watch(open, async (shouldOpen) => {
  if (!shouldOpen || checking.value) return
  checking.value = true

  try {
    await refresh()
    emit('checked')

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
      toast.add({
        title: 'La factura todavía existe en Siigo',
        description: context.value.invoice.siigoInvoiceName || context.value.invoice.siigoInvoiceId || undefined,
        color: 'info',
        icon: 'i-lucide-file-check-2'
      })
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
      customerError.value = ''
      customerModalOpen.value = true
    }
  } finally {
    checking.value = false
  }
})

async function saveCustomer(input: SiigoCustomerMutationInput) {
  const customerId = context.value?.customer?.id
  if (!customerId || savingCustomer.value) return

  savingCustomer.value = true
  customerError.value = ''

  try {
    await $fetch<SiigoCustomer>(`/api/siigo/customers/${encodeURIComponent(customerId)}`, {
      method: 'PUT',
      body: input
    })
    await refreshNuxtData('customers-catalog-request')
    customerModalOpen.value = false
    toast.add({
      title: 'Datos del cliente actualizados',
      description: 'Se guardaron en Siigo y PostgreSQL. Continuaremos con la factura.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
    await nextTick()
    open.value = true
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    customerError.value = response.data?.statusMessage || response.message || 'No fue posible actualizar el cliente.'
  } finally {
    savingCustomer.value = false
  }
}

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
  <OrdersSiigoOrderInvoiceCustomerModal
    v-if="context?.customer"
    v-model:open="customerModalOpen"
    :customer="context.customer"
    :missing-fields="context.missingCustomerFields"
    :saving="savingCustomer"
    :error-message="customerError"
    @submit="saveCustomer"
  />
  <OrdersSiigoOrderSiigoInvoiceModal
    v-if="context && catalogsReady"
    v-model:open="open"
    :context="context"
    :saving="saving"
    @submit="createInvoice"
  />
</template>
