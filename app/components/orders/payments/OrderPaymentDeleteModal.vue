<script setup lang="ts">
import type { OrderPayment } from '~/types/siigo-payments'
import { paymentMethodLabel } from '~/utils/orderPayment'

const props = defineProps<{
  orderId: string
  payment: OrderPayment
}>()

const emit = defineEmits<{
  deleted: [paymentId: string]
}>()

const open = defineModel<boolean>('open', { required: true })
const deleting = shallowRef(false)
const toast = useToast()

const currency = computed(() => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: props.payment.currencyCode
}))

async function deletePayment() {
  if (deleting.value) return
  deleting.value = true

  try {
    await $fetch(
      `/api/orders/${encodeURIComponent(props.orderId)}/payments/${encodeURIComponent(props.payment.id)}`,
      { method: 'DELETE' }
    )
    open.value = false
    emit('deleted', props.payment.id)
    toast.add({
      title: 'Pago eliminado',
      description: 'El saldo y el estado de pago del pedido fueron actualizados.',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo eliminar el pago',
      description: response.data?.statusMessage || response.message || 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-circle-alert',
      duration: 8000
    })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Eliminar pago"
    description="Esta acción es permanente y volverá a calcular el saldo del pedido."
    :dismissible="!deleting"
    :close="deleting ? false : undefined"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="¿Seguro que deseas eliminar este pago?"
        :description="`${currency.format(payment.amount)} · ${paymentMethodLabel(payment.paymentMethod)}`"
      />
    </template>

    <template #footer>
      <UButton
        label="Conservar pago"
        color="neutral"
        variant="outline"
        :disabled="deleting"
        @click="open = false"
      />
      <UButton
        label="Eliminar pago"
        color="error"
        icon="i-lucide-trash-2"
        :loading="deleting"
        @click="deletePayment"
      />
    </template>
  </UModal>
</template>
