<script setup lang="ts">
import type { InventorySettings } from '#shared/types/inventory'
import { mexicoToday } from '~/utils/datetime'
import type { PurchaseView } from '~/types/purchases'
import { purchaseDateLabel, purchaseQuantity, receiptStatus } from '~/utils/purchaseFormat'

const props = defineProps<{ order: PurchaseView }>()
const emit = defineEmits<{ saved: [order: PurchaseView] }>()
const { busy, error, run } = usePurchaseAction(() => props.order, value => emit('saved', value))
const { data: inventorySettings } = await useFetch<InventorySettings>('/api/inventory/settings')
const warehouseId = shallowRef('')
const date = shallowRef(mexicoToday())
const quantities = reactive<Record<string, number>>({})
const formOpen = shallowRef(false)
const voiding = shallowRef<string>()

const status = computed(() => receiptStatus(props.order.receiptStatus))
const pendingItems = computed(() => props.order.items
  .map(item => ({ ...item, pending: Number((item.quantity - item.received).toFixed(6)) }))
  .filter(item => item.pending > 0))
const canReceive = computed(() => props.order.status === 'confirmada' && props.order.receiptStatus !== 'completa')
const hasQuantities = computed(() => Object.values(quantities).some(q => q > 0))
const itemName = (id: string) => props.order.items.find(i => i.id === id)?.name ?? 'Producto'

function receiveAll() {
  for (const item of pendingItems.value) quantities[item.id] = item.pending
}
async function receive() {
  const items = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, quantity }))
  if (await run({ action: 'receive', warehouseId: warehouseId.value || undefined, date: date.value, items })) {
    Object.keys(quantities).forEach(k => quantities[k] = 0)
    formOpen.value = false
  }
}
async function voidReceipt(reason: string) {
  if (voiding.value && await run({ action: 'voidReceipt', id: voiding.value, reason })) voiding.value = undefined
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold text-primary">
            Recepciones
          </h2>
          <UBadge
            :label="status.label"
            :color="status.color"
            variant="subtle"
            size="sm"
          />
        </div>
        <UButton
          v-if="canReceive && !formOpen"
          label="Registrar recepción"
          icon="i-lucide-package-plus"
          size="sm"
          @click="formOpen = true"
        />
      </div>
    </template>

    <div class="flex flex-col gap-4">
      <UAlert
        v-if="error"
        :title="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
      />

      <form v-if="canReceive && formOpen" class="flex flex-col gap-4 rounded-lg border border-default p-4" @submit.prevent="receive">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <UFormField label="Fecha de recepción">
            <PurchasesPurchaseDate v-model="date" />
          </UFormField>
          <UButton
            label="Recibir todo lo pendiente"
            icon="i-lucide-list-checks"
            color="neutral"
            variant="subtle"
            size="sm"
            @click="receiveAll"
          />
        </div>
        <InventoryWarehousePicker v-model="warehouseId" :disabled="busy" />
        <ul class="divide-y divide-default rounded-lg border border-default">
          <li
            v-for="item in pendingItems"
            :key="item.id"
            class="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <label :for="`receive-${item.id}`" class="min-w-0 text-sm">
              <span class="block truncate font-medium">{{ item.name }}</span>
              <span class="text-muted">Pendiente: {{ purchaseQuantity(item.pending) }} de {{ purchaseQuantity(item.quantity) }}</span>
            </label>
            <UInputNumber
              :id="`receive-${item.id}`"
              v-model="quantities[item.id]"
              :min="0"
              :max="item.pending"
              :step="1"
              :step-snapping="false"
              :format-options="{ maximumFractionDigits: 6 }"
              size="sm"
              placeholder="0"
              class="w-full sm:w-36"
            />
          </li>
        </ul>
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="flex items-center gap-1.5 text-xs text-muted">
            <UIcon name="i-lucide-info" class="size-4 shrink-0" />
            {{ inventorySettings?.enabledAt ? 'Esta recepción agrega unidades al almacén interno seleccionado.' : 'El inventario interno todavía no está activado. Esta recepción conservará su comportamiento histórico.' }}
          </p>
          <div class="flex gap-2">
            <UButton
              label="Cancelar"
              color="neutral"
              variant="outline"
              class="flex-1 justify-center sm:flex-none"
              :disabled="busy"
              @click="formOpen = false"
            />
            <UButton
              type="submit"
              label="Guardar recepción"
              icon="i-lucide-package-check"
              class="flex-1 justify-center sm:flex-none"
              :loading="busy"
              :disabled="!hasQuantities || Boolean(inventorySettings?.enabledAt && !warehouseId)"
            />
          </div>
        </div>
      </form>

      <p v-if="!order.receipts.length && !formOpen" class="py-4 text-center text-sm text-muted">
        Aún no se registran recepciones.
      </p>

      <ul v-if="order.receipts.length" class="flex flex-col gap-3">
        <li
          v-for="receipt in order.receipts"
          :key="receipt.id"
          class="rounded-lg border border-default p-3"
          :class="receipt.voidedAt ? 'opacity-60' : ''"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <UIcon :name="receipt.voidedAt ? 'i-lucide-package-x' : 'i-lucide-package-check'" class="size-4 text-muted" />
              <span class="font-medium">{{ purchaseDateLabel(receipt.date) }}</span>
              <UBadge
                v-if="receipt.voidedAt"
                label="Anulada"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </div>
            <UButton
              v-if="!receipt.voidedAt"
              label="Anular"
              icon="i-lucide-undo-2"
              color="error"
              variant="ghost"
              size="sm"
              :disabled="busy"
              @click="voiding = receipt.id"
            />
          </div>
          <p v-if="receipt.warehouseName" class="mt-2 text-xs text-muted">
            Almacén interno: {{ receipt.warehouseName }}
          </p>
          <p v-if="receipt.inventoryMovements?.length" class="mt-1 text-xs text-muted">
            {{ receipt.inventoryMovements.map(m => `INV-${m.folio} (${m.type.replaceAll('_', ' ')})`).join(', ') }}
          </p>
          <ul class="mt-2 space-y-1 text-sm">
            <li v-for="item in receipt.items" :key="item.itemId" class="flex justify-between gap-3">
              <span class="truncate text-muted">{{ itemName(item.itemId) }}</span>
              <span class="shrink-0 tabular-nums">{{ purchaseQuantity(item.quantity) }}</span>
            </li>
          </ul>
          <p v-if="receipt.voidReason" class="mt-2 text-sm text-muted italic">
            “{{ receipt.voidReason }}”
          </p>
        </li>
      </ul>
    </div>

    <PurchasesPurchaseReasonModal
      :open="Boolean(voiding)"
      title="Anular recepción"
      description="Las cantidades volverán a quedar pendientes de recibir."
      confirm-label="Anular recepción"
      :busy="busy"
      @update:open="!$event && (voiding = undefined)"
      @confirm="voidReceipt"
    />
  </UCard>
</template>
