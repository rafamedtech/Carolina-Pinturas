<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ProductActivityRow, ProductActivitySection } from '#shared/types/product-activity'
import { formatDate } from '~/utils/datetime'
import { purchaseMoney, purchaseQuantity } from '~/utils/purchaseFormat'
import { orderStatusBadgeColor } from '~/utils/orderStatus'

const props = defineProps<{ rows: ProductActivityRow[], section: ProductActivitySection, loading?: boolean }>()
const showQuantity = computed(() => props.section !== 'expenses')
const showBalance = computed(() => props.section === 'movements' || props.section === 'counts')
const showAmount = computed(() => ['sales', 'purchases', 'expenses'].includes(props.section))
const quantityLabel = computed(() => props.section === 'counts' ? 'Contado' : props.section === 'movements' ? 'Variación' : 'Cantidad')
const balanceLabel = computed(() => props.section === 'counts' ? 'Esperado' : 'Existencia resultante')
const contextLabels: Record<ProductActivitySection, string> = {
  sales: 'Cliente',
  purchases: 'Proveedor',
  receipts: 'Proveedor',
  movements: 'Almacén',
  reservations: 'Almacén',
  counts: 'Almacén',
  expenses: 'Proveedor'
}
const detailLabels: Record<ProductActivitySection, string> = {
  sales: 'Factura',
  purchases: 'Detalle',
  receipts: 'Almacén',
  movements: 'Motivo',
  reservations: 'Cliente',
  counts: 'Motivo',
  expenses: 'Descripción'
}

function formattedQuantity(quantity?: string) {
  return quantity === undefined ? '—' : (quantity.startsWith('+') ? '+' : '') + purchaseQuantity(Number(quantity))
}

function cardFields(row: ProductActivityRow) {
  const fields = [{ label: contextLabels[props.section], value: row.context, fullWidth: true }]
  if (row.detail) fields.push({ label: detailLabels[props.section], value: row.detail, fullWidth: true })
  if (showBalance.value) fields.push({ label: balanceLabel.value, value: row.balance === undefined ? '—' : purchaseQuantity(Number(row.balance)), fullWidth: false })
  return fields
}

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
        <ListRecordCard
          :title="row.reference"
          :eyebrow="formatDate(row.date)"
          :title-to="row.href"
          :aria-label="`Abrir ${row.reference}`"
          :fields="cardFields(row)"
          :summary-label="showAmount ? 'Importe' : quantityLabel"
          :summary-color="showAmount ? 'primary' : 'neutral'"
        >
          <template v-if="row.status" #trailing>
            <UBadge
              :color="orderStatusBadgeColor(row.statusColor ?? 'neutral')"
              variant="subtle"
              size="lg"
              class="max-w-40 whitespace-normal"
            >
              {{ statusLabel(row.status) }}
            </UBadge>
          </template>
          <template #field-value="{ field }">
            <span v-if="field.label === contextLabels[section]" class="flex items-center gap-1">
              <span class="min-w-0">{{ field.value || '—' }}</span>
              <AppButton
                v-if="row.contextHref"
                :to="row.contextHref"
                icon="i-lucide-external-link"
                intent="quiet"
                size="xs"
                class="shrink-0"
                :aria-label="`Abrir perfil de ${row.context}`"
              />
            </span>
            <template v-else>
              {{ field.value }}
            </template>
          </template>
          <template v-if="showQuantity && showAmount" #summary-leading>
            <div class="min-w-0">
              <dt class="text-muted">
                {{ quantityLabel }}
              </dt>
              <dd class="text-base font-semibold text-highlighted tabular-nums">
                {{ formattedQuantity(row.quantity) }}
              </dd>
            </div>
          </template>
          <template #summary>
            <template v-if="showAmount">
              {{ row.amount ? purchaseMoney(Number(row.amount.value), row.amount.currency) : '—' }}
              <span v-if="row.amount" class="text-xs font-normal text-muted">{{ row.amount.currency }}</span>
            </template>
            <span v-else class="tabular-nums" :class="{ 'text-success': row.quantity?.startsWith('+'), 'text-error': row.quantity?.startsWith('-') }">
              {{ formattedQuantity(row.quantity) }}
            </span>
          </template>
        </ListRecordCard>
      </li>
    </ul>
    <DetailTable
      :data="rows"
      :columns="columns"
      :get-row-id="row => row.id"
      aria-label="Actividad registrada para el producto"
      class="hidden sm:block"
    >
      <template #reference-cell="{ row: { original } }">
        <div class="flex items-center gap-2">
          <ULink v-if="original.href" :to="original.href" class="font-medium text-primary hover:underline">
            {{ original.reference }}
          </ULink>
          <span v-else class="font-medium text-highlighted">{{ original.reference }}</span>
          <UBadge
            v-if="original.status"
            :color="orderStatusBadgeColor(original.statusColor ?? 'neutral')"
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
          <div class="flex items-center gap-1">
            <span class="min-w-0 font-medium text-highlighted">{{ original.context }}</span>
            <AppButton
              v-if="original.contextHref"
              :to="original.contextHref"
              icon="i-lucide-external-link"
              intent="quiet"
              size="xs"
              :ui="{ leadingIcon: 'size-5' }"
              class="shrink-0"
              :aria-label="`Abrir perfil de ${original.context}`"
            />
          </div>
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
        <span class="font-semibold text-primary">{{ amount ? purchaseMoney(Number(amount.value), amount.currency) : '—' }}</span>
        <span v-if="amount" class="text-xs text-muted">{{ amount.currency }}</span>
      </template>
    </DetailTable>
  </template>
</template>
