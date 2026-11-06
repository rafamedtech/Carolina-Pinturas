<script setup lang="ts">
import type { InventoryCommand } from '#shared/schemas/inventory'
import type { OrderReturnContext } from '#shared/types/inventory'
import { formatDate } from '~/utils/datetime'

const props = defineProps<{ orderId: string, orderNumber: string }>()
const open = defineModel<boolean>('open', { required: true })
const { data, status, error: loadError, refresh } = useFetch<OrderReturnContext>(
  () => `/api/orders/${encodeURIComponent(props.orderId)}/return-context`,
  { server: false, lazy: true }
)
const toast = useToast()
const { busy, error, run } = useInventoryAction(() => {
  toast.add({ title: 'Devolución registrada', color: 'success', icon: 'i-lucide-circle-check' })
  open.value = false
})

function submit(command: InventoryCommand['command']) {
  if (command.action === 'return') return run({ ...command, orderId: props.orderId })
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Devolución · ${orderNumber}`"
    description="Registra los productos que regresan al inventario."
    :dismissible="!busy"
    :close="busy ? false : undefined"
    scrollable
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <p v-if="status === 'idle' || status === 'pending'" role="status" class="text-sm text-muted">
          Cargando productos y devoluciones…
        </p>
        <div v-else-if="loadError" class="space-y-2">
          <UAlert color="error" :title="loadError.data?.statusMessage || 'No se pudieron cargar los datos de devolución.'" />
          <UButton
            label="Reintentar"
            color="neutral"
            variant="outline"
            @click="refresh()"
          />
        </div>
        <template v-else-if="data">
          <UAlert v-if="!data.source" color="neutral" title="El pedido no tiene una salida de inventario vigente" />
          <UAlert v-else-if="!data.source.lines.length" color="neutral" title="Ya se devolvieron todas las unidades de la salida" />
          <UAlert v-else-if="!data.warehouses.length" color="warning" title="Se requiere un almacén activo para recibir la devolución" />
          <template v-else>
            <UAlert v-if="error" color="error" :title="error" />
            <InventoryMovementForm
              :source="data.source"
              :warehouses="data.warehouses"
              :activated="true"
              :admin="false"
              :busy="busy"
              @submit="submit"
            />
          </template>
          <section v-if="data.returns.length" class="space-y-2 border-t border-default pt-4">
            <h3 class="font-medium">
              Devoluciones registradas
            </h3>
            <ul class="divide-y divide-default text-sm">
              <li v-for="movement in data.returns" :key="movement.id" class="space-y-1 py-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium">INV-{{ movement.folio }}</span>
                  <span class="text-muted">{{ formatDate(movement.date) }}</span>
                  <UBadge
                    v-if="movement.reversal"
                    color="neutral"
                    variant="subtle"
                    label="Revertida"
                  />
                </div>
                <p class="break-words text-muted">
                  {{ movement.reason }}
                </p>
              </li>
            </ul>
          </section>
        </template>
      </div>
    </template>
  </UModal>
</template>
