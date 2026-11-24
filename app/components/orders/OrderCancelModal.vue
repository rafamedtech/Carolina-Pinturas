<script setup lang="ts">
import { readApiErrorMessage } from '@rafamedtech/nuxt-shared/utils'
import type { SalesOrderDetail } from '~/types/orders'

const props = defineProps<{
  orderId: string
  orderNumber: string
  version: number
}>()

const emit = defineEmits<{
  cancelled: [order: SalesOrderDetail]
  failed: []
}>()

const open = defineModel<boolean>('open', { required: true })
const cancelling = shallowRef(false)
const reason = ref('')
const errorMessage = ref('')
const toast = useToast()

watch(open, (value) => {
  if (!value) return
  reason.value = ''
  errorMessage.value = ''
})

async function cancelOrder() {
  if (cancelling.value) return
  cancelling.value = true
  errorMessage.value = ''

  try {
    const order = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/status`,
      {
        method: 'PATCH',
        body: {
          statusKey: 'cancelado',
          note: reason.value.trim() || 'Pedido cancelado desde el menú de opciones.',
          version: props.version
        }
      }
    )

    emit('cancelled', order)
    open.value = false
    toast.add({
      title: 'Pedido cancelado',
      description: `${props.orderNumber} cambió al estado cancelado.`,
      color: 'success',
      icon: 'i-lucide-circle-check'
    })
  } catch (fetchError: unknown) {
    errorMessage.value = readApiErrorMessage(fetchError) || 'No se pudo cancelar el pedido. Intenta de nuevo.'
    emit('failed')
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <DestructiveConfirmModal
    v-model:open="open"
    title="Cancelar pedido"
    :description="`¿Seguro que deseas cancelar el pedido ${orderNumber}?`"
    cancel-label="Conservar pedido"
    confirm-label="Cancelar pedido"
    confirm-icon="i-lucide-ban"
    :loading="cancelling"
    :error="errorMessage"
    @confirm="cancelOrder"
  >
    <template #context>
      <UAlert
        color="warning"
        variant="subtle"
        title="El pedido quedará marcado como cancelado"
        description="El cambio se registrará en el historial del pedido."
        icon="i-lucide-triangle-alert"
      />
    </template>

    <template #reason="{ loading }">
      <UFormField label="Motivo (opcional)">
        <UTextarea
          v-model="reason"
          :maxlength="1000"
          :disabled="loading"
          class="w-full"
        />
      </UFormField>
    </template>
  </DestructiveConfirmModal>
</template>
