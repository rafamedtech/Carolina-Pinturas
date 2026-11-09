<script setup lang="ts">
import type { BadgeProps, TableColumn } from '@nuxt/ui'
import type { VisibilityState } from '@tanstack/table-core'
import type { InventoryMovement } from '#shared/types/inventory'
import { formatDate, formatDateTime } from '~/utils/datetime'

defineProps<{ rows: InventoryMovement[], admin: boolean, operational: boolean, kardex?: boolean }>()
const emit = defineEmits<{ return: [row: InventoryMovement], reverse: [row: InventoryMovement] }>()
const tables = useTemplateRef('tables')
const columnVisibility = ref<VisibilityState>({})
defineExpose({ getColumns: () => tables.value?.[0]?.getColumns() ?? [] })
const movementTypes: Record<string, { label: string, color: BadgeProps['color'] }> = {
  inicial: { label: 'Inicial', color: 'primary' },
  entrada: { label: 'Entrada', color: 'success' },
  salida: { label: 'Salida', color: 'error' },
  traspaso: { label: 'Traspaso', color: 'info' },
  devolucion_cliente: { label: 'Devolución cliente', color: 'success' },
  devolucion_proveedor: { label: 'Devolución proveedor', color: 'error' },
  ajuste: { label: 'Ajuste', color: 'warning' },
  surtido: { label: 'Surtido', color: 'error' },
  recepcion: { label: 'Recepción', color: 'success' },
  reversion: { label: 'Reversión', color: 'warning' }
}
function movementType(type: string) {
  return movementTypes[type] ?? { label: type.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase()), color: 'neutral' as const }
}
const lineColumns: TableColumn<InventoryMovement['lines'][number]>[] = [
  { id: 'product', header: 'Producto', cell: ({ row }) => `${row.original.productCode} · ${row.original.productName}` },
  { accessorKey: 'warehouseName', header: 'Almacén' },
  { accessorKey: 'delta', header: 'Movimiento', cell: ({ row }) => h('span', { class: row.original.delta.startsWith('-') ? 'text-error font-mono' : 'text-success font-mono' }, `${row.original.delta.startsWith('-') ? '' : '+'}${row.original.delta}`) },
  { accessorKey: 'balanceAfter', header: 'Existencia resultante' }
]
</script>

<template>
  <div class="space-y-3">
    <DetailCard
      v-for="row in rows"
      :key="row.id"
      :ui="{ wrapper: 'w-full', header: 'mb-0 w-full' }"
    >
      <template #header>
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div class="shrink-0 space-y-2">
            <p class="text-xs font-medium text-muted">
              {{ formatDate(row.date) }}
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <UIcon name="i-lucide-arrow-left-right" class="size-5 text-primary" />
              <h3 class="font-semibold text-highlighted">
                INV-{{ row.folio }}
              </h3>
              <UBadge :color="movementType(row.type).color" variant="subtle">
                {{ movementType(row.type).label }}
              </UBadge>
              <UBadge v-if="row.reversal" color="warning" variant="subtle">
                Revertido
              </UBadge>
            </div>
          </div>
          <div class="flex min-w-0 flex-col gap-4 lg:ml-auto lg:max-w-4xl lg:flex-row lg:items-start lg:justify-end">
            <div class="min-w-0 lg:w-full lg:max-w-3xl">
              <DetailFields
                class="sm:grid-cols-3"
                :fields="[
                  { label: 'Motivo', value: row.reason },
                  { label: 'Registrado por', value: row.actorName },
                  { label: 'Fecha de registro', value: formatDateTime(row.createdAt) },
                  ...(row.receiptId ? [{ label: 'Recepción', value: row.receiptId, fullWidth: true }] : [])
                ]"
              />
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
              <AppButton
                v-if="row.orderId"
                :to="`/ventas/${row.orderId}`"
                label="Ver pedido"
                icon="i-lucide-shopping-bag"
                intent="quiet"
                size="sm"
              />
              <AppButton
                v-if="!kardex && !row.reversal && operational && ['surtido', 'recepcion'].includes(row.type)"
                label="Devolución"
                intent="secondary"
                size="sm"
                @click="emit('return', row)"
              />
              <AppButton
                v-if="!kardex && !row.reversal && admin && !row.reversalOfId && !['surtido', 'recepcion'].includes(row.type)"
                label="Revertir"
                intent="danger"
                color="error"
                variant="subtle"
                size="sm"
                @click="emit('reverse', row)"
              />
            </div>
          </div>
        </div>
      </template>
      <div class="space-y-3 md:hidden">
        <ListRecordCard
          v-for="line in row.lines"
          :key="line.id"
          :title="line.productName"
          :eyebrow="line.productCode"
          :fields="[
            { label: 'Almacén', value: line.warehouseName, fullWidth: true },
            { label: 'Existencia resultante', value: line.balanceAfter }
          ]"
          summary-label="Movimiento"
          :summary-value="`${line.delta.startsWith('-') ? '' : '+'}${line.delta}`"
        >
          <template #summary>
            <span :class="line.delta.startsWith('-') ? 'text-error' : 'text-success'">
              {{ line.delta.startsWith('-') ? '' : '+' }}{{ line.delta }}
            </span>
          </template>
        </ListRecordCard>
        <UEmpty v-if="!row.lines.length" title="Sin partidas" variant="naked" />
      </div>
      <DetailTable
        ref="tables"
        v-model:column-visibility="columnVisibility"
        :data="row.lines"
        :columns="lineColumns"
        empty="Sin partidas."
        class="hidden md:block"
      />
    </DetailCard>
    <UEmpty
      v-if="!rows.length"
      icon="i-lucide-arrow-left-right"
      title="Sin movimientos para estos filtros"
      variant="naked"
    />
  </div>
</template>
