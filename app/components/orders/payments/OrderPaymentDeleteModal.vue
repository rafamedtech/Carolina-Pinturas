<script setup lang="ts">
import { createCurrencyFormatter, readApiErrorMessage } from '@rafamedtech/nuxt-shared/utils'
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
const errorMessage = ref('')
const toast = useToast()

watch(open, (value) => {
  if (value) errorMessage.value = ''
})

const currency = computed(() => createCurrencyFormatter(props.payment.currencyCode))

async function deletePayment() {
  if (deleting.value) return
  deleting.value = true
  errorMessage.value = ''

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
    errorMessage.value = readApiErrorMessage(fetchError) || 'No se pudo eliminar el pago. Intenta de nuevo.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <DestructiveConfirmModal
    v-model:open="open"
    title="Eliminar pago"
    description="Esta acción es permanente y volverá a calcular el saldo del pedido."
    cancel-label="Conservar pago"
    confirm-label="Eliminar pago"
    confirm-icon="i-lucide-trash-2"
    :loading="deleting"
    :error="errorMessage"
    @confirm="deletePayment"
  >
    <template #context>
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="¿Seguro que deseas eliminar este pago?"
        :description="`${currency.format(payment.amount)} · ${paymentMethodLabel(payment.paymentMethod)}`"
      />
    </template>
  </DestructiveConfirmModal>
</template>
