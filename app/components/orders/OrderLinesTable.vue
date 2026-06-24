<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { DraftOrderLine } from '~/composables/useMockOrder'

const props = defineProps<{
  lines: DraftOrderLine[]
  total: number
}>()

const emit = defineEmits<{
  remove: [productId: string]
}>()

const UButton = resolveComponent('UButton')
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const columns: TableColumn<DraftOrderLine>[] = [{
  accessorKey: 'code',
  header: 'Código'
}, {
  accessorKey: 'name',
  header: 'Producto'
}, {
  accessorKey: 'quantity',
  header: () => h('div', { class: 'text-right' }, 'Cantidad'),
  cell: ({ row }) => h('div', { class: 'text-right' }, row.getValue('quantity'))
}, {
  accessorKey: 'unitPrice',
  header: () => h('div', { class: 'text-right' }, 'Precio unitario'),
  cell: ({ row }) => h('div', { class: 'text-right' }, currency.format(Number(row.getValue('unitPrice'))))
}, {
  id: 'total',
  header: () => h('div', { class: 'text-right' }, 'Importe'),
  cell: ({ row }) => h('div', { class: 'text-right font-medium' }, currency.format(row.original.quantity * row.original.unitPrice))
}, {
  id: 'actions',
  header: '',
  cell: ({ row }) => h(UButton, {
    'icon': 'i-lucide-trash-2',
    'color': 'neutral',
    'variant': 'ghost',
    'aria-label': `Quitar ${row.original.name}`,
    'onClick': () => emit('remove', row.original.productId)
  })
}]
</script>

<template>
  <UCard class="shrink-0" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-highlighted">
            Partidas del pedido
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ lines.length }} {{ lines.length === 1 ? 'producto agregado' : 'productos agregados' }}
          </p>
        </div>
        <p class="text-right text-sm text-muted">
          Total
          <span class="ms-2 text-base font-semibold text-highlighted">{{ currency.format(total) }}</span>
        </p>
      </div>
    </template>

    <UTable
      :data="props.lines"
      :columns="columns"
      empty="Agrega productos para iniciar el pedido."
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        separator: 'h-0'
      }"
    />
  </UCard>
</template>
