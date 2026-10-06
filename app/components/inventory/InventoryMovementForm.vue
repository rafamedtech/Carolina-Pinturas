<script setup lang="ts">
import type { InventoryWarehouse, InventoryProduct, InventoryMovement } from '#shared/types/inventory'
import type { InventoryCommand } from '#shared/schemas/inventory'
import { fetchAllPages } from '~/composables/useCsvExport'
import { mexicoToday } from '~/utils/datetime'

const props = defineProps<{ warehouses: InventoryWarehouse[], activated: boolean, admin: boolean, busy: boolean, source?: InventoryMovement }>()
const emit = defineEmits<{ submit: [command: InventoryCommand['command']] }>()
const form = reactive({ type: props.activated ? 'entrada' : 'inicial', warehouseId: props.source?.lines[0]?.warehouseId ?? '', destinationId: '', date: mexicoToday(), reason: '', lines: [] as Array<{ productId: string, quantity: string }> })
const selected = shallowRef('')
const requestFetch = useRequestFetch()
const { data: products, status, error, refresh } = await useAsyncData('inventory-movement-products', () =>
  fetchAllPages<InventoryProduct>('/api/inventory/products', {}, 100, requestFetch)
)
const enabledProducts = computed(() => (products.value ?? []).filter(p => p.enabled))
const availableProducts = computed(() => enabledProducts.value.filter(p => !form.lines.some(l => l.productId === p.id)))
const items = computed(() => props.source ? props.source.lines.map(l => ({ label: `${l.productCode} · ${l.productName}`, value: l.productId })) : enabledProducts.value.map(p => ({ label: `${p.code} · ${p.name}`, value: p.id })))
const labels = reactive<Record<string, string>>({})
function add() {
  if (!selected.value || props.busy || (!props.source && error.value) || form.lines.some(l => l.productId === selected.value)) return
  labels[selected.value] = items.value.find(p => p.value === selected.value)?.label ?? selected.value
  form.lines.push({ productId: selected.value, quantity: '' })
  selected.value = ''
}
function submit() {
  if (props.source) emit('submit', { action: 'return', sourceMovementId: props.source.id, warehouseId: form.warehouseId, date: form.date, reason: form.reason, lines: form.lines })
  else emit('submit', { action: 'move', ...form, type: form.type as 'inicial' | 'entrada' | 'salida' | 'traspaso', destinationId: form.destinationId || undefined })
}
const warehouseOptions = computed(() => props.warehouses.filter(w => w.active).map(w => ({ label: w.name, value: w.id })))
</script>

<template>
  <form class="space-y-4" @submit.prevent="submit">
    <UAlert
      v-if="source"
      :title="`Devolución vinculada al movimiento INV-${source.folio}`"
      description="Captura las unidades que regresan físicamente. Las facturas y los pagos conservan sus importes."
      color="neutral"
    />
    <UFormField v-if="!source" label="Tipo">
      <USelect v-model="form.type" :items="activated ? [{ label: 'Entrada', value: 'entrada' }, { label: 'Salida', value: 'salida' }, { label: 'Traspaso', value: 'traspaso' }] : admin ? [{ label: 'Saldo inicial', value: 'inicial' }] : []" class="w-full" />
    </UFormField>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Almacén" required>
        <USelect
          v-model="form.warehouseId"
          :items="warehouseOptions"
          placeholder="Selecciona un almacén"
          class="w-full"
        />
      </UFormField><UFormField label="Fecha">
        <PurchasesPurchaseDate v-model="form.date" />
      </UFormField>
    </div>
    <UFormField v-if="form.type === 'traspaso' && !source" label="Almacén destino" required>
      <USelect
        v-model="form.destinationId"
        :items="warehouseOptions.filter(w => w.value !== form.warehouseId)"
        placeholder="Selecciona un destino"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Motivo" required>
      <UTextarea
        v-model="form.reason"
        minlength="3"
        maxlength="2000"
        required
        class="w-full"
      />
    </UFormField>
    <div class="space-y-3 rounded-lg border border-default bg-elevated/30 p-4">
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <UFormField label="Producto" class="min-w-0">
          <USelectMenu
            v-if="source"
            v-model="selected"
            :items="items"
            value-key="value"
            :disabled="busy"
            placeholder="Agregar producto"
            class="w-full"
          />
          <ProductsProductSearch
            v-else
            v-model="selected"
            :products="availableProducts"
            aria-label="Producto"
            :loading="status === 'pending'"
            :disabled="busy || Boolean(error)"
          />
        </UFormField>
        <UButton
          label="Agregar producto"
          icon="i-lucide-plus"
          :disabled="!selected || busy || (!source && Boolean(error))"
          @click="add"
        />
      </div>
      <p v-if="!source && error" role="alert" class="text-sm text-error">
        No se pudieron cargar los productos.
        <UButton
          label="Reintentar"
          variant="link"
          :disabled="busy"
          @click="refresh()"
        />
      </p>
      <ul class="divide-y divide-default">
        <li v-for="(line, index) in form.lines" :key="line.productId" class="flex flex-wrap items-center gap-3 py-3">
          <span class="min-w-48 flex-1 text-sm">{{ labels[line.productId] }}</span><UInput
            v-model="line.quantity"
            inputmode="decimal"
            placeholder="Cantidad"
            aria-label="Cantidad"
            required
            class="w-36"
          /><UButton
            icon="i-lucide-x"
            aria-label="Quitar producto"
            color="neutral"
            variant="ghost"
            @click="form.lines.splice(index, 1)"
          />
        </li>
      </ul>
    </div>
    <UButton
      type="submit"
      :label="source ? 'Registrar devolución' : 'Aplicar movimiento'"
      :disabled="!form.lines.length || !form.warehouseId"
      :loading="busy"
    />
  </form>
</template>
