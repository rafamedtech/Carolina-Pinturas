<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import OrderLineCards from './OrderLineCards.vue'
import type { DraftOrderLine } from '~/composables/useOrderDraft'

const props = defineProps<{
  lines: readonly DraftOrderLine[]
  total: number
  quoteMode?: boolean
}>()

const emit = defineEmits<{
  remove: [productId: string]
  observations: [productId: string, value: string]
  quantity: [productId: string, value: number]
}>()

const UButton = resolveComponent('UButton')
const UInput = resolveComponent('UInput')
const UInputNumber = resolveComponent('UInputNumber')
const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const tableLines = computed(() => [...props.lines])

function updateObservations(productId: string, value: string) {
  emit('observations', productId, value)
}

function updateQuantity(productId: string, value: number) {
  emit('quantity', productId, value)
}

const columns: TableColumn<DraftOrderLine>[] = [{
  accessorKey: 'code',
  header: 'Código'
}, {
  accessorKey: 'name',
  header: 'Producto'
}, {
  accessorKey: 'observations',
  header: 'Observaciones',
  cell: ({ row }) => h(UInput, {
    'modelValue': row.original.observations,
    'placeholder': 'Observaciones…',
    'size': 'sm',
    'variant': 'subtle',
    'aria-label': `Observaciones de ${row.original.name}`,
    'onUpdate:modelValue': (value: string) => emit('observations', row.original.productId, value)
  })
}, {
  accessorKey: 'quantity',
  header: () => h('div', { class: 'text-right' }, 'Cantidad'),
  cell: ({ row }) => h(UInputNumber, {
    'modelValue': row.original.quantity,
    'min': 0.000001,
    'step': 1,
    'size': 'sm',
    'variant': 'subtle',
    'class': 'ms-auto w-28',
    'aria-label': `Cantidad de ${row.original.name}`,
    'onUpdate:modelValue': (value: number) => emit('quantity', row.original.productId, value)
  })
}, {
  accessorKey: 'unitPrice',
  header: () => h('div', { class: 'text-right' }, 'Precio unitario'),
  cell: ({ row }) => h('div', { class: 'text-right' }, currency.format(Number(row.getValue('unitPrice'))))
}, {
  id: 'total',
  header: () => h('div', { class: 'text-right' }, 'Importe'),
  cell: ({ row }) => {
    const listedTotal = row.original.quantity * row.original.unitPrice
    const total = row.original.taxIncluded
      ? listedTotal
      : listedTotal * (1 + row.original.taxPercentage / 100)
    return h('div', { class: 'text-right font-medium' }, currency.format(total))
  }
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
            {{ props.quoteMode ? 'Partidas de la cotización' : 'Partidas del pedido' }}
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

    <OrderLineCards
      :lines="lines"
      :quote-mode="props.quoteMode"
      @remove="emit('remove', $event)"
      @observations="updateObservations"
      @quantity="updateQuantity"
    />

    <UTable
      :data="tableLines"
      :columns="columns"
      :empty="`Agrega productos para iniciar ${props.quoteMode ? 'la cotización' : 'el pedido'}.`"
      class="hidden md:block"
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
