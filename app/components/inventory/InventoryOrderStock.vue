<script setup lang="ts">
import type { InventoryStock, OrderInventoryView } from '#shared/types/inventory'

const props = defineProps<{ orderId: string, version: number }>()
const emit = defineEmits<{ saved: [] }>()
const { user } = useAuth()
const mayAssign = computed(() => ['admin', 'mostrador', 'vendedor'].includes(user.value?.role ?? ''))
const { data, error: loadError, refresh } = await useFetch<OrderInventoryView>(() => `/api/orders/${props.orderId}/inventory`, { watch: [() => props.version] })
const selected = shallowRef('')
watch(data, (value) => {
  selected.value = value?.warehouseId ?? ''
}, { immediate: true })
const busy = shallowRef(false), error = shallowRef('')
let requestId = ''
watch(selected, () => {
  requestId = ''
})
async function assign() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  if (!requestId) requestId = crypto.randomUUID()
  try {
    await $fetch(`/api/orders/${props.orderId}/warehouse`, { method: 'PATCH', body: { requestId, warehouseId: selected.value, version: props.version } })
    requestId = ''
    await refresh()
    emit('saved')
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'No se pudo asignar el almacén.'
  } finally { busy.value = false }
}
function showKardex(row: InventoryStock) {
  return navigateTo({ path: '/inventario', query: { productId: row.productId, warehouseId: row.warehouseId } })
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-semibold text-primary">
          Inventario interno
        </h2><UBadge :color="data?.managed ? 'primary' : 'neutral'">
          {{ data?.managed ? data.dispatched ? 'Salida registrada' : 'Control de existencias' : 'Histórico sin control interno' }}
        </UBadge>
      </div>
    </template><UAlert v-if="loadError || error" :title="error || 'No se pudo cargar inventario.'" color="error" /><div v-if="data?.managed" class="space-y-4">
      <form v-if="mayAssign && !data.dispatched" class="flex flex-wrap items-end gap-3" @submit.prevent="assign">
        <InventoryWarehousePicker v-model="selected" :disabled="busy" class="min-w-60 flex-1" /><UButton
          type="submit"
          label="Asignar almacén"
          :disabled="!selected || selected === data.warehouseId"
          :loading="busy"
        />
      </form><InventoryStockTable :rows="data.stocks" @kardex="showKardex" /><p v-if="data.movements.length" class="text-sm text-muted">
        Movimientos: {{ data.movements.map(m => `INV-${m.folio} (${m.type.replaceAll('_', ' ')})`).join(', ') }}
      </p>
    </div><p v-else class="text-sm text-muted">
      Este pedido se creó antes de la activación del inventario interno. Conserva su operación histórica.
    </p>
  </UCard>
</template>
