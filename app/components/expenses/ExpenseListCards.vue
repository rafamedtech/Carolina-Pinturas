<script setup lang="ts">
import type { ExpenseRecord } from '~/types/expenses'
import { paymentMethodLabel } from '~/utils/orderPayment'

defineProps<{ expenses: readonly ExpenseRecord[] }>()
const emit = defineEmits<{ select: [expense: ExpenseRecord] }>()
function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currencyCode }).format(amount)
}
</script>

<template>
  <div class="flex flex-col gap-3 md:hidden">
    <template v-if="expenses.length">
      <UCard
        v-for="expense in expenses"
        :key="expense.id"
        role="button"
        tabindex="0"
        :aria-label="`${expense.purchasePaymentId ? 'Consultar gasto de compra' : 'Editar gasto'}: ${expense.description}`"
        class="cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
        @click="emit('select', expense)"
        @keydown.enter.prevent="emit('select', expense)"
        @keydown.space.prevent="emit('select', expense)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs font-medium uppercase tracking-wide text-muted">
              Gasto
            </p>
            <p class="truncate text-lg font-semibold text-highlighted">
              {{ expense.description }}
            </p>
          </div>
          <p class="shrink-0 text-lg font-semibold text-highlighted">
            {{ formatCurrency(expense.amount, expense.currencyCode) }}
          </p>
        </div>

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div class="col-span-2">
            <dt class="text-muted">
              Proveedor
            </dt>
            <dd class="font-medium text-highlighted">
              {{ expense.provider }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Fecha
            </dt>
            <dd>{{ formatDate(expense.date) }}</dd>
          </div>
          <div>
            <dt class="text-muted">
              Método
            </dt>
            <dd>{{ paymentMethodLabel(expense.paymentMethod) }}</dd>
          </div>
          <div class="col-span-2">
            <dt class="text-muted">
              Categoría
            </dt>
            <dd>{{ expense.category }}</dd>
          </div>
        </dl>
      </UCard>
    </template>

    <div
      v-else
      class="flex flex-col items-center gap-2 rounded-lg border border-default bg-elevated/50 px-4 py-10 text-center"
    >
      <UIcon name="i-lucide-receipt-text" class="size-8 text-muted" />
      <p class="text-sm text-muted">
        No hay gastos para mostrar.
      </p>
    </div>
  </div>
</template>
