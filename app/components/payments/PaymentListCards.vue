<script setup lang="ts">
import type { PaymentListItem } from '~/types/payments'
import { paymentMethodLabel } from '~/utils/orderPayment'

defineProps<{ payments: readonly PaymentListItem[], returnTo: string }>()
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
</script>

<template>
  <div class="flex flex-col gap-3 md:hidden">
    <template v-if="payments.length">
      <UCard
        v-for="payment in payments"
        :key="payment.id"
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              Pedido
            </p>
            <NuxtLink
              :to="{
                path: `/ventas/${encodeURIComponent(payment.order.id)}`,
                query: { returnTo }
              }"
              class="text-lg font-semibold text-primary hover:underline"
            >
              {{ payment.order.number }}
            </NuxtLink>
          </div>
          <p class="text-lg font-semibold text-highlighted">
            {{ currency.format(payment.amount) }}
          </p>
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div class="col-span-2">
            <dt class="text-muted">
              Cliente
            </dt>
            <dd class="font-medium text-highlighted">
              {{ payment.order.customerName }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Fecha
            </dt>
            <dd>{{ formatDate(payment.paymentDate) }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Método
            </dt>
            <dd>{{ paymentMethodLabel(payment.paymentMethod) }}</dd>
          </div>
          <div v-if="payment.reference || payment.siigoVoucherName" class="col-span-2">
            <dt class="text-muted">
              Referencia
            </dt>
            <dd>{{ payment.reference || payment.siigoVoucherName }}</dd>
          </div>
        </dl>
      </UCard>
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
