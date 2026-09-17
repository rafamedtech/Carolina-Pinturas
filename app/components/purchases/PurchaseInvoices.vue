<script setup lang="ts">
import { mexicoToday } from '~/utils/datetime'
import type { PurchaseView } from '~/types/purchases'

const props = defineProps<{ order: PurchaseView }>()
const emit = defineEmits<{ saved: [order: PurchaseView] }>()
const { busy, error, run } = usePurchaseAction(() => props.order, o => emit('saved', o))
const form = reactive({ folio: '', date: mexicoToday(), dueDate: mexicoToday(), amount: 0 })
async function add() {
  if (await run({ action: 'invoice', ...form })) {
    form.folio = ''
    form.amount = 0
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">
        Facturas y abonos
      </h2>
    </template>
    <div class="space-y-5">
      <p>Facturado: {{ order.invoiced.toFixed(2) }} {{ order.currencyCode }} · Diferencia con orden: {{ (order.invoiced - order.total).toFixed(2) }} · Saldo: {{ order.balance.toFixed(2) }}</p>
      <UAlert v-if="error" :title="error" color="error" />
      <form v-if="order.status === 'confirmada'" class="grid gap-3 md:grid-cols-2" @submit.prevent="add">
        <UFormField label="Folio de factura">
          <UInput
            v-model="form.folio"
            required
            :maxlength="100"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="`Importe real (${order.currencyCode})`">
          <UInput
            v-model.number="form.amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField label="Fecha de factura">
          <PurchasesPurchaseDate v-model="form.date" />
        </UFormField><UFormField label="Vencimiento">
          <PurchasesPurchaseDate v-model="form.dueDate" />
        </UFormField>
        <UButton type="submit" label="Registrar factura" :loading="busy" />
      </form>
      <PurchasesPurchaseInvoice
        v-for="invoice in order.invoices"
        :key="invoice.id + ':' + order.version"
        :order="order"
        :invoice="invoice"
        @saved="emit('saved', $event)"
      />
    </div>
  </UCard>
</template>
