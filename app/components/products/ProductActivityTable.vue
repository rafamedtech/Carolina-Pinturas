<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ProductActivityRow, ProductActivitySection } from '#shared/types/product-activity'
import { formatDate } from '~/utils/datetime'
import { purchaseMoney, purchaseQuantity } from '~/utils/purchaseFormat'

const props = defineProps<{ rows: ProductActivityRow[], section: ProductActivitySection, loading?: boolean }>()
const showQuantity = computed(() => props.section !== 'expenses')
const showBalance = computed(() => props.section === 'movements' || props.section === 'counts')
const showAmount = computed(() => ['sales', 'purchases', 'expenses'].includes(props.section))
const quantityLabel = computed(() => props.section === 'counts' ? 'Contado' : props.section === 'movements' ? 'Variación' : 'Cantidad')
const balanceLabel = computed(() => props.section === 'counts' ? 'Esperado' : 'Existencia resultante')
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
  if (showQuantity.value) columns.push({ accessorKey: 'quantity', header: quantityLabel.value, meta: numeric })
  if (showBalance.value) columns.push({ accessorKey: 'balance', header: balanceLabel.value, meta: numeric })
  if (showAmount.value) columns.push({ accessorKey: 'amount', header: 'Importe', meta: numeric })
  return columns
})
</script>

<template>
  <ListLoading v-if="loading" />
  <UEmpty
    v-else-if="!rows.length"
    icon="i-lucide-inbox"
    title="Sin actividad en esta sección"
    description="No hay registros vinculados a este producto."
    variant="naked"
  />
  <template v-else>
    <ul class="min-w-0 space-y-3 sm:hidden" aria-label="Actividad registrada para el producto">
      <li v-for="row in rows" :key="row.id" class="min-w-0">
        <UCard :ui="{ body: 'space-y-3 p-4' }">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 space-y-1">
              <ULink v-if="row.href" :to="row.href" class="block text-sm font-medium break-words text-primary">
                {{ row.reference }}
              </ULink>
              <p v-else class="text-sm font-medium break-words text-highlighted">
                {{ row.reference }}
              </p>
              <UBadge
                v-if="row.status"
                color="neutral"
                variant="subtle"
                size="sm"
                class="max-w-full whitespace-normal"
              >
                {{ statusLabel(row.status) }}
              </UBadge>
            </div>
            <span class="shrink-0 text-xs text-muted tabular-nums">{{ formatDate(row.date) }}</span>
          </div>
          <div class="min-w-0 text-sm break-words">
            <p class="font-medium text-highlighted">
              {{ row.context }}
            </p>
            <p v-if="row.detail" class="mt-1 text-xs text-muted">
              {{ row.detail }}
            </p>
          </div>
          <USeparator />
          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div v-if="showQuantity" class="min-w-0">
              <dt class="text-xs text-muted">
                {{ quantityLabel }}
              </dt>
              <dd class="mt-1 font-medium break-words tabular-nums" :class="{ 'text-success': row.quantity?.startsWith('+'), 'text-error': row.quantity?.startsWith('-') }">
                {{ row.quantity === undefined ? '—' : (row.quantity.startsWith('+') ? '+' : '') + purchaseQuantity(Number(row.quantity)) }}
              </dd>
            </div>
            <div v-if="showBalance" class="min-w-0">
              <dt class="text-xs text-muted">
                {{ balanceLabel }}
              </dt>
              <dd class="mt-1 font-medium break-words tabular-nums">
                {{ row.balance === undefined ? '—' : purchaseQuantity(Number(row.balance)) }}
              </dd>
            </div>
            <div v-if="showAmount" class="min-w-0">
              <dt class="text-xs text-muted">
                Importe
              </dt>
              <dd class="mt-1 font-medium break-words tabular-nums">
                {{ row.amount ? purchaseMoney(Number(row.amount.value), row.amount.currency) : '—' }}
                <span v-if="row.amount" class="text-xs text-muted">{{ row.amount.currency }}</span>
              </dd>
            </div>
          </dl>
        </UCard>
      </li>
    </ul>
    <UTable
      :data="rows"
      :columns="columns"
      :get-row-id="row => row.id"
      aria-label="Actividad registrada para el producto"
      class="hidden min-w-0 border-y border-default sm:block"
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
    </UTable>
  </template>
</template>
