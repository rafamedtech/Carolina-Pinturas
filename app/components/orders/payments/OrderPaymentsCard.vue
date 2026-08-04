<script setup lang="ts">
import type {
  CreateOrderPaymentInput,
  OrderPayment,
  OrderPaymentContext
} from '~/types/siigo-payments'
import { canDeletePaymentRecord, paymentMethodLabel } from '~/utils/orderPayment'

const props = defineProps<{
  orderId: string
}>()

const emit = defineEmits<{
  created: [payment: OrderPayment]
  deleted: [paymentId: string]
}>()

const open = shallowRef(false)
const saving = shallowRef(false)
const deleteOpen = shallowRef(false)
const deletingPayment = shallowRef<OrderPayment | null>(null)
const toast = useToast()
const { user } = useAuth()
const {
  data: context,
  status,
  error,
  refresh
} = useFetch<OrderPaymentContext>(
  () => `/api/orders/${encodeURIComponent(props.orderId)}/payments/context`,
  {
    key: `order-payments-${props.orderId}`,
    lazy: true
  }
)

const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible consultar los pagos del pedido.'
)

function formatCurrency(value: number, currency = 'MXN') {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency
  }).format(value)
}

function formatDate(value: string) {
  return value.split('T')[0]!.split('-').reverse().join('/')
}

function paymentTitle(payment: OrderPayment) {
  if (payment.siigo) {
    return payment.siigo.voucherName || `Recepción Siigo pendiente · ${payment.siigo.invoiceName}`
  }
  return payment.reference || paymentMethodLabel(payment.paymentMethod)
}

const mayDeletePayments = computed(() => user.value?.role === 'admin')

function paymentCanBeDeleted(payment: OrderPayment) {
  return canDeletePaymentRecord(
    payment.provider,
    payment.externalStatus,
    payment.siigo?.voucherId
  )
}

function openDeletePayment(payment: OrderPayment) {
  if (!mayDeletePayments.value || !paymentCanBeDeleted(payment)) return
  deletingPayment.value = payment
  deleteOpen.value = true
}

async function onPaymentDeleted(paymentId: string) {
  await refresh()
  deletingPayment.value = null
  emit('deleted', paymentId)
}

async function createPayment(input: CreateOrderPaymentInput) {
  if (saving.value) return
  saving.value = true

  try {
    const payment = await $fetch<OrderPayment>(
      `/api/orders/${encodeURIComponent(props.orderId)}/payments`,
      {
        method: 'POST',
        body: input
      }
    )
    open.value = false
    await refresh()
    emit('created', payment)

    if (payment.provider === 'siigo' && payment.externalStatus !== 'synced') {
      toast.add({
        title: payment.externalStatus === 'unknown'
          ? 'Pago guardado; resultado de Siigo incierto'
          : 'Pago guardado; falta sincronizar con Siigo',
        description: payment.externalError || 'No vuelvas a crear el pago. Revisa su estado antes de reintentar Siigo.',
        color: 'warning',
        icon: 'i-lucide-triangle-alert',
        duration: 9000
      })
      return
    }

    toast.add({
      title: payment.provider === 'siigo' ? 'Pago registrado y enviado a Siigo' : 'Pago registrado',
      description: payment.provider === 'siigo'
        ? payment.siigo?.voucherName || 'La recepción quedó vinculada.'
        : 'El pago quedó guardado en PostgreSQL.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo registrar el pago',
      description: response.data?.statusMessage || response.message || 'Revisa los datos e intenta nuevamente.',
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
  <div class="space-y-4">
    <div class="flex justify-end">
      <UButton
        v-if="context"
        label="Agregar pago"
        icon="i-lucide-plus"
        size="md"
        :disabled="context.balance <= 0"
        @click="open = true"
      />
    </div>

    <div v-if="status === 'pending'" class="space-y-3">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-database-zap"
      title="No fue posible cargar los pagos"
      :description="errorMessage"
    />

    <template v-else-if="context">
      <div class="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-elevated p-3 text-sm">
        <div>
          <p class="text-muted">
            Pedido
          </p>
          <p class="font-semibold">
            {{ formatCurrency(context.orderTotal) }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Pagado
          </p>
          <p class="font-semibold text-success">
            {{ formatCurrency(context.paidTotal) }}
          </p>
        </div>
        <div>
          <p class="text-muted">
            Pendiente
          </p>
          <p class="font-semibold text-error">
            {{ formatCurrency(context.balance) }}
          </p>
        </div>
      </div>

      <ul v-if="context.payments.length" class="divide-y divide-default">
        <li
          v-for="payment in context.payments"
          :key="payment.id"
          class="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-highlighted">
                {{ paymentTitle(payment) }}
              </p>
              <UBadge
                v-if="payment.provider === 'siigo'"
                color="primary"
                variant="subtle"
                label="Siigo"
              />
              <UBadge
                v-if="payment.provider === 'siigo' && payment.externalStatus !== 'synced'"
                color="warning"
                variant="subtle"
                :label="payment.externalStatus === 'unknown' ? 'Por verificar' : 'No sincronizado'"
              />
            </div>
            <p class="mt-1 text-sm text-muted">
              {{ paymentMethodLabel(payment.paymentMethod) }} · {{ formatDate(payment.paymentDate) }}
              <template v-if="payment.siigo">
                · Factura {{ payment.siigo.invoiceName }}
              </template>
            </p>
            <p class="mt-1 text-xs text-dimmed">
              Registró {{ payment.createdBy.name }}
            </p>
            <p v-if="payment.externalError" class="mt-1 text-xs text-warning">
              {{ payment.externalError }}
            </p>
          </div>
          <div class="flex items-center gap-1">
            <UBadge
              color="success"
              variant="subtle"
              :label="formatCurrency(payment.amount, payment.currencyCode)"
            />
            <UTooltip
              v-if="mayDeletePayments"
              :text="paymentCanBeDeleted(payment)
                ? 'Eliminar pago'
                : 'Los pagos vinculados con Siigo no se pueden eliminar desde la aplicación.'"
            >
              <span class="inline-flex">
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :disabled="!paymentCanBeDeleted(payment)"
                  :aria-label="`Eliminar pago de ${formatCurrency(payment.amount, payment.currencyCode)}`"
                  @click="openDeletePayment(payment)"
                />
              </span>
            </UTooltip>
          </div>
        </li>
      </ul>

      <p v-else class="text-sm text-muted">
        Este pedido todavía no tiene pagos registrados.
      </p>

      <OrdersPaymentsOrderPaymentsModal
        v-model:open="open"
        :context="context"
        :saving="saving"
        @submit="createPayment"
      />
      <OrdersPaymentsOrderPaymentDeleteModal
        v-if="deletingPayment"
        v-model:open="deleteOpen"
        :order-id="orderId"
        :payment="deletingPayment"
        @deleted="onPaymentDeleted"
      />
    </template>
  </div>
</template>
