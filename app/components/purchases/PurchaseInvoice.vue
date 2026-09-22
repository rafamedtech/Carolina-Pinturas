<script setup lang="ts">
import { mexicoToday } from '~/utils/datetime'
import type { PurchaseView, PurchaseInvoiceView } from '~/types/purchases'
import { PAYMENT_METHODS, paymentMethodLabel } from '~/utils/orderPayment'
import { invoiceStatus, purchaseDateLabel, purchaseMoney } from '~/utils/purchaseFormat'

const props = defineProps<{ order: PurchaseView, invoice: PurchaseInvoiceView }>()
const emit = defineEmits<{ saved: [order: PurchaseView] }>()
const { busy, error, run } = usePurchaseAction(() => props.order, o => emit('saved', o))
const amount = shallowRef(props.invoice.balance)
const date = shallowRef(mexicoToday())
const exchangeRate = shallowRef(1)
const method = shallowRef<'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'otro'>('transferencia')
const mode = shallowRef<'edit' | 'pay'>()
const voiding = shallowRef<{ kind: 'invoice' } | { kind: 'payment', id: string }>()
const edit = reactive({ folio: props.invoice.folio, date: props.invoice.date, dueDate: props.invoice.dueDate, amount: props.invoice.amount })
const canEdit = computed(() => !props.invoice.voidedAt && !props.invoice.payments.some(p => !p.voidedAt))
const canPay = computed(() => !props.invoice.voidedAt && props.invoice.balance > 0)
const status = computed(() => invoiceStatus(props.invoice.status))
const money = (value: number) => purchaseMoney(value, props.order.currencyCode)
const paidPercent = computed(() => props.invoice.amount ? Math.round((props.invoice.amount - props.invoice.balance) / props.invoice.amount * 100) : 0)

const menu = computed(() => [
  [{ label: 'Editar factura', icon: 'i-lucide-pencil', onSelect: () => { mode.value = 'edit' } }],
  [{ label: 'Anular factura', icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => { voiding.value = { kind: 'invoice' } } }]
])

async function saveEdit() {
  if (await run({ action: 'editInvoice', id: props.invoice.id, ...edit })) mode.value = undefined
}
async function pay() {
  if (await run({ action: 'pay', invoiceId: props.invoice.id, date: date.value, amount: amount.value, exchangeRate: exchangeRate.value, method: method.value })) mode.value = undefined
}
async function confirmVoid(reason: string) {
  const target = voiding.value
  if (!target) return
  const ok = target.kind === 'invoice'
    ? await run({ action: 'voidInvoice', id: props.invoice.id, reason })
    : await run({ action: 'voidPayment', id: target.id, reason })
  if (ok) voiding.value = undefined
}
</script>

<template>
  <div class="rounded-lg border border-default" :class="invoice.voidedAt ? 'opacity-60' : ''">
    <div class="flex flex-col gap-3 p-4">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="font-semibold text-highlighted">
              Factura {{ invoice.folio }}
            </h3>
            <UBadge
              :label="status.label"
              :color="status.color"
              variant="subtle"
              size="sm"
            />
          </div>
          <p class="mt-1 text-sm text-muted">
            {{ purchaseDateLabel(invoice.date) }} · Vence {{ purchaseDateLabel(invoice.dueDate) }}
          </p>
        </div>
        <UDropdownMenu v-if="canEdit" :items="menu" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            aria-label="Acciones de factura"
            :disabled="busy"
          />
        </UDropdownMenu>
      </div>

      <div class="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p class="text-muted">
            Importe
          </p>
          <p class="font-semibold tabular-nums">
            {{ money(invoice.amount) }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-muted">
            Saldo
          </p>
          <p class="font-semibold tabular-nums" :class="invoice.balance > 0 ? 'text-warning' : 'text-success'">
            {{ money(invoice.balance) }}
          </p>
        </div>
      </div>
      <UProgress
        v-if="!invoice.voidedAt"
        :model-value="paidPercent"
        :color="invoice.balance > 0 ? 'primary' : 'success'"
        size="xs"
      />

      <p v-if="invoice.voidReason" class="text-sm text-muted italic">
        Anulada: “{{ invoice.voidReason }}”
      </p>

      <UAlert
        v-if="error"
        :title="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
      />

      <form v-if="mode === 'edit' && canEdit" class="grid gap-3 rounded-lg bg-elevated/50 p-3 sm:grid-cols-2" @submit.prevent="saveEdit">
        <UFormField label="Folio">
          <UInput
            v-model="edit.folio"
            required
            :maxlength="100"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="`Importe (${order.currencyCode})`">
          <UInputNumber
            v-model="edit.amount"
            :min="0.01"
            :step="0.01"
            :step-snapping="false"
            :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
            :increment="false"
            :decrement="false"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Fecha">
          <PurchasesPurchaseDate v-model="edit.date" />
        </UFormField>
        <UFormField label="Vencimiento">
          <PurchasesPurchaseDate v-model="edit.dueDate" />
        </UFormField>
        <div class="flex justify-end gap-2 sm:col-span-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="busy"
            @click="mode = undefined"
          />
          <UButton
            type="submit"
            label="Guardar factura"
            icon="i-lucide-save"
            :loading="busy"
          />
        </div>
      </form>

      <form v-if="mode === 'pay' && canPay" class="grid gap-3 rounded-lg bg-elevated/50 p-3 sm:grid-cols-2" @submit.prevent="pay">
        <UFormField label="Fecha del abono">
          <PurchasesPurchaseDate v-model="date" />
        </UFormField>
        <UFormField :label="`Abono (${order.currencyCode})`" :hint="`Máx. ${money(invoice.balance)}`">
          <UInputNumber
            v-model="amount"
            :min="0.01"
            :max="invoice.balance"
            :step="0.01"
            :step-snapping="false"
            :format-options="{ minimumFractionDigits: 2, maximumFractionDigits: 2 }"
            :increment="false"
            :decrement="false"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Método">
          <USelect v-model="method" :items="PAYMENT_METHODS.map(m => ({ label: m.label, value: m.key }))" class="w-full" />
        </UFormField>
        <UFormField label="Tipo de cambio a MXN">
          <UInputNumber
            v-model="exchangeRate"
            :min="0.000001"
            :step="0.01"
            :step-snapping="false"
            :format-options="{ maximumFractionDigits: 6 }"
            :increment="false"
            :decrement="false"
            :disabled="order.currencyCode === 'MXN'"
            class="w-full"
          />
        </UFormField>
        <p class="text-xs text-muted sm:col-span-2">
          El abono también registra un gasto.
        </p>
        <div class="flex justify-end gap-2 sm:col-span-2">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="busy"
            @click="mode = undefined"
          />
          <UButton
            type="submit"
            label="Registrar abono y gasto"
            icon="i-lucide-banknote"
            :loading="busy"
            :disabled="!(amount > 0)"
          />
        </div>
      </form>

      <UButton
        v-if="canPay && mode !== 'pay'"
        label="Registrar abono"
        icon="i-lucide-banknote"
        color="neutral"
        variant="subtle"
        size="sm"
        class="self-start"
        @click="mode = 'pay'"
      />
    </div>

    <ul v-if="invoice.payments.length" class="divide-y divide-default border-t border-default">
      <li
        v-for="payment in invoice.payments"
        :key="payment.id"
        class="flex items-center justify-between gap-3 px-4 py-2 text-sm"
        :class="payment.voidedAt ? 'opacity-60' : ''"
      >
        <div class="min-w-0">
          <p class="font-medium tabular-nums" :class="payment.voidedAt ? 'line-through' : ''">
            {{ money(payment.amount) }}
          </p>
          <p class="truncate text-muted">
            {{ purchaseDateLabel(payment.date) }} · {{ paymentMethodLabel(payment.method) }}<template v-if="order.currencyCode !== 'MXN'">
              · TC {{ payment.exchangeRate }}
            </template>
          </p>
          <p v-if="payment.voidedAt" class="text-muted italic">
            Anulado: “{{ payment.voidReason }}”
          </p>
        </div>
        <UButton
          v-if="!payment.voidedAt"
          label="Anular"
          icon="i-lucide-undo-2"
          color="error"
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="voiding = { kind: 'payment', id: payment.id }"
        />
      </li>
    </ul>

    <PurchasesPurchaseReasonModal
      :open="Boolean(voiding)"
      :title="voiding?.kind === 'payment' ? 'Anular abono' : 'Anular factura'"
      :description="voiding?.kind === 'payment' ? 'Se anulará el abono y el gasto asociado.' : `La factura ${invoice.folio} quedará anulada.`"
      :confirm-label="voiding?.kind === 'payment' ? 'Anular abono y gasto' : 'Anular factura'"
      :busy="busy"
      @update:open="!$event && (voiding = undefined)"
      @confirm="confirmVoid"
    />
  </div>
</template>
