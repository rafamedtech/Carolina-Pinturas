<script setup lang="ts">
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
const toast = useToast()

async function cancelOrder() {
  if (cancelling.value) return
  cancelling.value = true

  try {
    const order = await $fetch<SalesOrderDetail>(
      `/api/orders/${encodeURIComponent(props.orderId)}/status`,
      {
        method: 'PATCH',
        body: {
          statusKey: 'cancelado',
          note: 'Pedido cancelado desde el menú de opciones.',
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
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'No se pudo cancelar el pedido',
      description: response.data?.statusMessage || response.message || 'Intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
    emit('failed')
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Cancelar pedido"
    :description="`¿Seguro que deseas cancelar el pedido ${orderNumber}?`"
    :dismissible="!cancelling"
    :close="cancelling ? false : undefined"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <UAlert
        color="warning"
        variant="subtle"
        title="El pedido quedará marcado como cancelado"
        description="El cambio se registrará en el historial del pedido."
        icon="i-lucide-triangle-alert"
      />
    </template>

    <template #footer>
      <UButton
        label="Conservar pedido"
        color="neutral"
        variant="outline"
        :disabled="cancelling"
        @click="open = false"
      />
      <UButton
        label="Cancelar pedido"
        color="error"
        icon="i-lucide-ban"
        :loading="cancelling"
        @click="cancelOrder"
      />
    </template>
  </UModal>
</template>
