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
      <ListRecordCard
        v-for="expense in expenses"
        :key="expense.id"
        :title="expense.description"
        :eyebrow="formatDate(expense.date)"
        :aria-label="`${expense.purchasePaymentId ? 'Consultar gasto de compra' : 'Editar gasto'}: ${expense.description}`"
        :fields="[
          { label: 'Proveedor', value: expense.provider, fullWidth: true },
          { label: 'Método', value: paymentMethodLabel(expense.paymentMethod) },
          { label: 'Categoría', value: expense.category }
        ]"
        summary-label="Importe"
        :summary-value="formatCurrency(expense.amount, expense.currencyCode)"
        actionable
        @select="emit('select', expense)"
      />
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
