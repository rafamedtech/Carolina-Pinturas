<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InventoryMovement } from '#shared/types/inventory'
import { formatDate, formatDateTime } from '~/utils/datetime'

defineProps<{ rows: InventoryMovement[], admin: boolean, operational: boolean, kardex?: boolean }>()
const emit = defineEmits<{ return: [row: InventoryMovement], reverse: [row: InventoryMovement] }>()
const lineColumns: TableColumn<InventoryMovement['lines'][number]>[] = [
  { id: 'product', header: 'Producto', cell: ({ row }) => `${row.original.productCode} · ${row.original.productName}` },
  { accessorKey: 'warehouseName', header: 'Almacén' },
  { accessorKey: 'delta', header: 'Movimiento', cell: ({ row }) => h('span', { class: row.original.delta.startsWith('-') ? 'text-error font-mono' : 'text-success font-mono' }, `${row.original.delta.startsWith('-') ? '' : '+'}${row.original.delta}`) },
  { accessorKey: 'balanceAfter', header: 'Existencia resultante' }
]
</script>

<template>
  <div class="space-y-3">
    <UCard v-for="row in rows" :key="row.id" :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="font-semibold">INV-{{ row.folio }}</span><UBadge color="neutral" variant="subtle">
              {{ row.type.replaceAll('_', ' ') }}
            </UBadge><UBadge v-if="row.reversal" color="warning" variant="subtle">
              Revertido
            </UBadge>
          </div><span class="text-sm text-muted">{{ formatDate(row.date) }}</span>
        </div>
      </template>
      <ListTable :data="row.lines" :columns="lineColumns" empty="Sin partidas." />
      <template #footer>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm">
            <p>{{ row.reason }}</p><p class="text-xs text-muted">
              {{ row.actorName }} · {{ formatDateTime(row.createdAt) }}
            </p><NuxtLink v-if="row.orderId" :to="`/ventas/${row.orderId}`" class="text-primary underline">Ver pedido</NuxtLink><span v-if="row.receiptId" class="text-xs text-muted">Recepción {{ row.receiptId }}</span>
          </div><div v-if="!kardex && !row.reversal" class="flex gap-2">
            <UButton
              v-if="operational && ['surtido', 'recepcion'].includes(row.type)"
              label="Devolución"
              variant="outline"
              size="sm"
              @click="emit('return', row)"
            /><UButton
              v-if="admin && !row.reversalOfId && !['surtido', 'recepcion'].includes(row.type)"
              label="Revertir"
              color="error"
              variant="ghost"
              size="sm"
              @click="emit('reverse', row)"
            />
          </div>
        </div>
      </template>
    </UCard>
    <p v-if="!rows.length" class="rounded-lg border border-default p-8 text-center text-muted">
      Sin movimientos para estos filtros.
    </p>
  </div>
</template>
