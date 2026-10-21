<script setup lang="ts">
import type { SalesOrderItem } from '~/types/orders'

const props = defineProps<{
  orderId: string
  item: SalesOrderItem
  version: number
  inventoryDispatched: boolean
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ deleted: [itemId: string] }>()
const deleting = shallowRef(false)
const error = shallowRef('')
const toast = useToast()

watch(open, (value) => {
  if (value) error.value = ''
})

async function deleteItem() {
  if (deleting.value) return
  deleting.value = true
  error.value = ''
  try {
    await $fetch(`/api/orders/${encodeURIComponent(props.orderId)}/items/${encodeURIComponent(props.item.id)}`, {
      method: 'DELETE',
      body: { version: props.version }
    })
    open.value = false
    emit('deleted', props.item.id)
    toast.add({ title: 'Partida eliminada', description: 'Se actualizaron los totales y el estado de pago del pedido.', color: 'success' })
  } catch (fetchError: unknown) {
    const response = fetchError as { data?: { statusMessage?: string }, message?: string }
    error.value = response.data?.statusMessage || response.message || 'No se pudo eliminar la partida.'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Eliminar partida"
    description="Esta acción es permanente y recalculará los totales del pedido."
    :dismissible="!deleting"
    :close="deleting ? false : undefined"
    :ui="{ footer: 'justify-end' }"
  >
    <template #body>
      <div class="space-y-4">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="¿Seguro que deseas eliminar esta partida?"
          :description="`${item.code} · ${item.name} · Cantidad: ${item.quantity}`"
        />
        <p v-if="inventoryDispatched" class="text-sm text-muted">
          La salida de inventario se conservará. Si el producto regresa, registra la devolución por separado.
        </p>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :description="error"
          icon="i-lucide-circle-alert"
        />
      </div>
    </template>
    <template #footer>
      <UButton
        label="Conservar partida"
        color="neutral"
        variant="outline"
        :disabled="deleting"
        @click="open = false"
      />
      <UButton
        label="Eliminar partida"
        color="error"
        icon="i-lucide-trash-2"
        :loading="deleting"
        @click="deleteItem"
      />
    </template>
  </UModal>
</template>
