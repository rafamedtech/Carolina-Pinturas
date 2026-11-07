<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ProductActivityRow, ProductActivitySection } from '#shared/types/product-activity'
import { formatDate } from '~/utils/datetime'
import { purchaseMoney, purchaseQuantity } from '~/utils/purchaseFormat'

const props = defineProps<{ rows: ProductActivityRow[], section: ProductActivitySection }>()
const showQuantity = computed(() => props.section !== 'expenses')
const showBalance = computed(() => props.section === 'movements' || props.section === 'counts')
const showAmount = computed(() => ['sales', 'purchases', 'expenses'].includes(props.section))
const statusLabels: Record<string, string> = {
  inicial: 'Saldo inicial',
  entrada: 'Entrada',
  salida: 'Salida',
  traspaso: 'Traspaso',
  devolucion_cliente: 'Devolución de cliente',
  devolucion_proveedor: 'Devolución a proveedor',
  ajuste: 'Ajuste',
  surtido: 'Surtido',
  recepcion: 'Recepción',
  reversion: 'Reversión',
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aplicado: 'Aplicado',
  cancelado: 'Cancelado'
}

function statusLabel(status: string) {
  return status.split(' · ').map(part => statusLabels[part] ?? part).join(' · ')
}
const columns = computed<TableColumn<ProductActivityRow>[]>(() => {
  const columns: TableColumn<ProductActivityRow>[] = [
    { accessorKey: 'reference', header: 'Referencia' },
    { accessorKey: 'date', header: 'Fecha' },
    { accessorKey: 'context', header: 'Detalle' }
  ]
  const numeric = { class: { th: 'text-right', td: 'text-right tabular-nums' } }
  if (showQuantity.value) columns.push({ accessorKey: 'quantity', header: props.section === 'counts' ? 'Contado' : props.section === 'movements' ? 'Variación' : 'Cantidad', meta: numeric })
  if (showBalance.value) columns.push({ accessorKey: 'balance', header: props.section === 'counts' ? 'Esperado' : 'Existencia resultante', meta: numeric })
  if (showAmount.value) columns.push({ accessorKey: 'amount', header: 'Importe', meta: numeric })
  return columns
})
</script>

<template>
  <UTable
    :data="rows"
    :columns="columns"
    :get-row-id="row => row.id"
    aria-label="Actividad registrada para el producto"
    class="min-w-0 border-y border-default"
    :ui="{ td: 'align-top', empty: 'p-0' }"
  >
    <template #reference-cell="{ row: { original } }">
      <div class="flex flex-col items-start gap-1">
        <ULink v-if="original.href" :to="original.href" class="font-medium text-primary hover:underline">
          {{ original.reference }}
        </ULink>
        <span v-else class="font-medium text-highlighted">{{ original.reference }}</span>
        <UBadge
          v-if="original.status"
          color="neutral"
          variant="subtle"
          size="sm"
        >
          {{ statusLabel(original.status) }}
        </UBadge>
      </div>
    </template>
    <template #date-cell="{ row: { original } }">
      {{ formatDate(original.date) }}
    </template>
    <template #context-cell="{ row: { original } }">
      <div class="min-w-32 whitespace-normal">
        <p class="font-medium text-highlighted">
          {{ original.context }}
        </p>
        <p v-if="original.detail" class="text-xs text-muted">
          {{ original.detail }}
        </p>
      </div>
    </template>
    <template #quantity-cell="{ row: { original: { quantity } } }">
      <span :class="{ 'text-success': quantity?.startsWith('+'), 'text-error': quantity?.startsWith('-') }">
        {{ quantity === undefined ? '—' : (quantity.startsWith('+') ? '+' : '') + purchaseQuantity(Number(quantity)) }}
      </span>
    </template>
    <template #balance-cell="{ row: { original: { balance } } }">
      {{ balance === undefined ? '—' : purchaseQuantity(Number(balance)) }}
    </template>
    <template #amount-cell="{ row: { original: { amount } } }">
      {{ amount ? purchaseMoney(Number(amount.value), amount.currency) : '—' }}
      <span v-if="amount" class="text-xs text-muted">{{ amount.currency }}</span>
    </template>
    <template #empty>
      <UEmpty
        icon="i-lucide-inbox"
        title="Sin actividad en esta sección"
        description="No hay registros vinculados a este producto."
        variant="naked"
      />
    </template>
  </UTable>
</template>
