<script setup lang="ts">
import { mexicoToday } from '~/utils/datetime'
import type { PurchaseView } from '~/types/purchases'

const props = defineProps<{ order: PurchaseView }>()
const emit = defineEmits<{ saved: [order: PurchaseView] }>()
const { busy, error, run } = usePurchaseAction(() => props.order, value => emit('saved', value))
const date = shallowRef(mexicoToday())
const quantities = reactive<Record<string, number>>({})
const reason = shallowRef('')
async function receive() {
  const items = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, quantity }))
  if (await run({ action: 'receive', date: date.value, items })) Object.keys(quantities).forEach(k => quantities[k] = 0)
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        Recepciones · {{ order.receiptStatus }}
      </h2>
    </template>
    <div class="space-y-4">
      <UAlert title="Actualizar inventario manualmente en Siigo" description="Esta recepción guarda cantidades recibidas; no modifica existencias." color="info" />
      <UAlert v-if="error" :title="error" color="error" />
      <form v-if="order.status === 'confirmada' && order.receiptStatus !== 'completa'" class="space-y-3" @submit.prevent="receive">
        <UFormField label="Fecha de recepción">
          <PurchasesPurchaseDate v-model="date" />
        </UFormField>
        <div v-for="item in order.items.filter(i => i.received < i.quantity)" :key="item.id" class="flex items-center justify-between gap-3">
          <label :for="`receive-${item.id}`">{{ item.name }} · Pendiente: {{ Number((item.quantity - item.received).toFixed(6)) }}</label>
          <UInput
            :id="`receive-${item.id}`"
            v-model.number="quantities[item.id]"
            type="number"
            :min="0"
            :max="Number((item.quantity - item.received).toFixed(6))"
            step="0.000001"
            class="w-32"
          />
        </div>
        <UButton label="Registrar recepción" type="submit" :loading="busy" />
      </form>
      <UFormField v-if="order.receipts.some(r => !r.voidedAt)" label="Motivo para anular recepción">
        <UInput v-model="reason" class="w-full" />
      </UFormField>
      <div v-for="receipt in order.receipts" :key="receipt.id" class="rounded border border-default p-3">
        <div class="flex items-center justify-between">
          <span>{{ receipt.date }} · {{ receipt.voidedAt ? 'Anulada' : 'Vigente' }}</span><UButton
            v-if="!receipt.voidedAt"
            label="Anular recepción"
            color="error"
            variant="ghost"
            :disabled="reason.trim().length < 3 || busy"
            @click="run({ action: 'voidReceipt', id: receipt.id, reason })"
          />
        </div>
        <p v-for="item in receipt.items" :key="item.itemId" class="text-sm text-muted">
          {{ order.items.find(i => i.id === item.itemId)?.name }}: {{ item.quantity }}
        </p>
        <p v-if="receipt.voidReason" class="text-sm">
          {{ receipt.voidReason }}
        </p>
      </div>
    </div>
  </UCard>
</template>
