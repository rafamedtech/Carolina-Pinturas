<script setup lang="ts">
import type { PaymentListItem } from '~/types/payments'
import { paymentMethodLabel } from '~/utils/orderPayment'

defineProps<{ payments: readonly PaymentListItem[], returnTo: string }>()
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
</script>

<template>
  <div class="flex flex-col gap-3 md:hidden">
    <template v-if="payments.length">
      <ListRecordCard
        v-for="payment in payments"
        :key="payment.id"
        :title="payment.order.number"
        :eyebrow="formatDate(payment.paymentDate)"
        :title-to="{ path: `/ventas/${encodeURIComponent(payment.order.id)}`, query: { returnTo } }"
        :fields="[
          { label: 'Cliente', value: payment.order.customerName, fullWidth: true },
          { label: 'Método', value: paymentMethodLabel(payment.paymentMethod) },
          ...(payment.reference || payment.siigoVoucherName ? [{ label: 'Referencia', value: payment.reference || payment.siigoVoucherName }] : [])
        ]"
        summary-label="Importe"
        :summary-value="currency.format(payment.amount)"
      />
    </template>

    <div
      v-else
      class="flex flex-col items-center gap-2 rounded-lg border border-default bg-elevated/50 px-4 py-10 text-center"
    >
      <UIcon name="i-lucide-hand-coins" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        No hay pagos para mostrar.
      </p>
    </div>
  </div>
</template>
