<script setup lang="ts">
import { mexicoToday } from '~/utils/datetime'
import type { PurchaseView, PurchaseInvoiceView } from '~/types/purchases'
import { PAYMENT_METHODS, paymentMethodLabel } from '~/utils/orderPayment'

const props = defineProps<{ order: PurchaseView, invoice: PurchaseInvoiceView }>()
const emit = defineEmits<{ saved: [order: PurchaseView] }>()
const { busy, error, run } = usePurchaseAction(() => props.order, o => emit('saved', o))
const amount = shallowRef(0)
const date = shallowRef(mexicoToday())
const exchangeRate = shallowRef(1)
const method = shallowRef<'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro'>('transferencia')
const reason = shallowRef('')
const editing = shallowRef(false)
const edit = reactive({ folio: props.invoice.folio, date: props.invoice.date, dueDate: props.invoice.dueDate, amount: props.invoice.amount })
const canEdit = computed(() => !props.invoice.voidedAt && !props.invoice.payments.some(p => !p.voidedAt))
</script>

<template>
  <div class="space-y-4 rounded-lg border border-default p-4">
    <div class="flex flex-wrap justify-between gap-2">
      <h3 class="font-semibold">
        Factura {{ invoice.folio }}
      </h3><UBadge color="neutral">
        {{ invoice.status }}
      </UBadge>
    </div>
    <p>Importe: {{ invoice.amount.toFixed(2) }} {{ order.currencyCode }} · Saldo: {{ invoice.balance.toFixed(2) }} · Vence: {{ invoice.dueDate }}</p>
    <UAlert v-if="error" :title="error" color="error" />
    <UButton
      v-if="canEdit"
      label="Editar factura"
      variant="ghost"
      @click="editing = !editing"
    />
    <form v-if="editing && canEdit" class="grid gap-3 md:grid-cols-2" @submit.prevent="run({ action: 'editInvoice', id: invoice.id, ...edit }).then(ok => { if (ok) editing = false })">
      <UFormField label="Folio">
        <UInput v-model="edit.folio" required />
      </UFormField><UFormField label="Importe">
        <UInput
          v-model.number="edit.amount"
          type="number"
          min="0.01"
          step="0.01"
          required
        />
      </UFormField>
      <UFormField label="Fecha">
        <PurchasesPurchaseDate v-model="edit.date" />
      </UFormField><UFormField label="Vencimiento">
        <PurchasesPurchaseDate v-model="edit.dueDate" />
      </UFormField>
      <UButton type="submit" label="Guardar factura" :loading="busy" />
    </form>
    <form v-if="!invoice.voidedAt && invoice.balance > 0" class="grid gap-3 md:grid-cols-2" @submit.prevent="run({ action: 'pay', invoiceId: invoice.id, date, amount, exchangeRate, method }).then(ok => { if (ok) amount = 0 })">
      <UFormField label="Fecha del abono">
        <PurchasesPurchaseDate v-model="date" />
      </UFormField>
      <UFormField :label="`Abono (${order.currencyCode})`">
        <UInput
          v-model.number="amount"
          type="number"
          min="0.01"
          :max="invoice.balance"
          step="0.01"
          required
          class="w-full"
        />
      </UFormField>
      <UFormField label="Método">
        <USelect v-model="method" :items="PAYMENT_METHODS.map(m => ({ label: m.label, value: m.key }))" class="w-full" />
      </UFormField>
      <UFormField label="Tipo de cambio a MXN">
        <UInput
          v-model.number="exchangeRate"
          type="number"
          min="0.000001"
          step="0.000001"
          :disabled="order.currencyCode === 'MXN'"
          required
          class="w-full"
        />
      </UFormField>
      <UButton type="submit" label="Registrar abono y gasto" :loading="busy" />
    </form>
    <UFormField v-if="!invoice.voidedAt" label="Motivo para anular factura o abono">
      <UInput v-model="reason" class="w-full" />
    </UFormField>
    <UButton
      v-if="canEdit"
      label="Anular factura"
      color="error"
      variant="ghost"
      :disabled="reason.trim().length < 3 || busy"
      @click="run({ action: 'voidInvoice', id: invoice.id, reason })"
    />
    <p v-if="invoice.voidReason">
      {{ invoice.voidReason }}
    </p>
    <div v-for="payment in invoice.payments" :key="payment.id" class="flex flex-wrap items-center justify-between gap-2 border-t border-default pt-3 text-sm">
      <span>{{ payment.date }} · {{ payment.amount.toFixed(2) }} {{ order.currencyCode }} · {{ paymentMethodLabel(payment.method) }} · TC {{ payment.exchangeRate }} {{ payment.voidedAt ? `· Anulado: ${payment.voidReason}` : '' }}</span>
      <UButton
        v-if="!payment.voidedAt"
        label="Anular abono y gasto"
        color="error"
        variant="ghost"
        :disabled="reason.trim().length < 3 || busy"
        @click="run({ action: 'voidPayment', id: payment.id, reason })"
      />
    </div>
  </div>
</template>
