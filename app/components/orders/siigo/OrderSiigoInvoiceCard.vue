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

const open = shallowRef(false)
const saving = shallowRef(false)
const toast = useToast()
const {
  data: context,
  status,
  error,
  refresh
} = useFetch<OrderSiigoInvoiceContext>(
  () => `/api/orders/${encodeURIComponent(props.orderId)}/siigo-invoice/context`,
  {
    key: `order-siigo-invoice-${props.orderId}`,
    lazy: true
  }
)

const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible consultar la configuración de facturas en Siigo.'
)
const catalogsReady = computed(() => Boolean(
  context.value?.documentTypes.length
  && context.value?.sellers.length
  && context.value?.paymentTypes.length
))
const statusLabel = computed(() => {
  if (context.value?.invoice?.status === 'created') return 'Borrador creado'
  if (context.value?.invoice?.status === 'uncertain') return 'Estado incierto'
  if (context.value?.invoice?.status === 'failed') return 'Creación fallida'
  return 'Creando'
})
const statusColor = computed(() => {
  if (context.value?.invoice?.status === 'created') return 'success'
  if (context.value?.invoice?.status === 'failed') return 'error'
  return 'warning'
})

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
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
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-primary">
            Factura borrador en Siigo
          </h2>
          <p class="mt-1 text-sm text-muted">
            Sólo para este pedido marcado como “Requiere factura”
          </p>
        </div>
        <UButton
          v-if="context?.eligible && (!context.invoice || context.invoice.status === 'failed')"
          label="Crear borrador"
          icon="i-lucide-file-plus-2"
          :disabled="!catalogsReady"
          @click="open = true"
        />
      </div>
    </template>

    <USkeleton v-if="status === 'pending'" class="h-20 w-full" />

    <UAlert
      v-else-if="error"
      color="warning"
      variant="subtle"
      icon="i-lucide-cloud-off"
      title="Siigo no disponible"
      :description="errorMessage"
    />

    <template v-else-if="context">
      <UAlert
        v-if="!context.writeEnabled"
        class="mb-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-lock-keyhole"
        title="Creación deshabilitada"
        description="El soporte está listo, pero las escrituras fiscales siguen bloqueadas hasta validarlas en un tenant seguro."
      />

      <UAlert
        v-if="context.eligibilityMessage"
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        title="No se creará una factura"
        :description="context.eligibilityMessage"
      />

      <div v-else-if="context.invoice" class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-medium text-highlighted">
              {{ context.invoice.siigoInvoiceName || context.invoice.siigoInvoiceId || context.orderNumber }}
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ formatCurrency(context.invoice.total) }} · sin timbrar
            </p>
          </div>
          <UBadge :color="statusColor" variant="subtle" :label="statusLabel" />
        </div>

        <UAlert
          v-if="context.invoice.status === 'uncertain'"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="No vuelvas a crearla todavía"
          description="Siigo pudo haber recibido la solicitud. Revisa el pedido directamente en Siigo antes de cualquier reintento."
        />
        <p v-if="context.invoice.lastError" class="text-sm text-muted">
          {{ context.invoice.lastError }}
        </p>
      </div>

      <p v-else class="text-sm text-muted">
        Cliente: {{ context.customerName }} · RFC {{ context.customerRfc }} · Total {{ formatCurrency(context.orderTotal) }}
      </p>

      <OrdersSiigoOrderSiigoInvoiceModal
        v-if="catalogsReady"
        v-model:open="open"
        :context="context"
        :saving="saving"
        @submit="createInvoice"
      />
    </template>
  </UCard>
</template>
