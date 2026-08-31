<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Column, SortingState } from '@tanstack/table-core'
import type { ExpenseRecord } from '~/types/expenses'
import { paymentMethodLabel } from '~/utils/orderPayment'

const props = defineProps<{
  expenses: readonly ExpenseRecord[]
  loading: boolean
}>()

const UButton = resolveComponent('UButton')
const tableExpenses = computed(() => [...props.expenses])
const sorting = ref<SortingState>([])

function formatDate(value: string) {
  return value.split('-').reverse().join('/')
}

function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currencyCode
  }).format(amount)
}

function sortableHeader(label: string, align: 'left' | 'right' = 'left') {
  return ({ column }: { column: Column<ExpenseRecord, unknown> }) => {
    const direction = column.getIsSorted()
    const nextDirection = column.getNextSortingOrder()
    const nextDirectionLabel = nextDirection === 'asc'
      ? 'ascendente'
      : nextDirection === 'desc'
        ? 'descendente'
        : 'quitar el orden'

    return h(UButton, {
      'label': label,
      'color': 'neutral',
      'variant': 'ghost',
      'size': 'sm',
      'class': align === 'right' ? 'w-full justify-end' : undefined,
      'trailingIcon': direction === 'asc'
        ? 'i-lucide-arrow-up'
        : direction === 'desc'
          ? 'i-lucide-arrow-down'
          : 'i-lucide-arrow-up-down',
      'aria-label': `Ordenar ${label} ${nextDirectionLabel}`,
      'onClick': () => column.toggleSorting()
    })
  }
}

const columns: TableColumn<ExpenseRecord>[] = [{
  accessorKey: 'date',
  header: sortableHeader('Fecha'),
  cell: ({ row }) => formatDate(row.original.date)
}, {
  accessorKey: 'category',
  header: sortableHeader('Categoría')
}, {
  accessorKey: 'description',
  header: sortableHeader('Descripción')
}, {
  accessorKey: 'provider',
  header: sortableHeader('Proveedor')
}, {
  id: 'paymentMethod',
  accessorFn: row => paymentMethodLabel(row.paymentMethod),
  header: sortableHeader('Método'),
  cell: ({ row }) => paymentMethodLabel(row.original.paymentMethod)
}, {
  id: 'createdBy',
  accessorFn: row => row.createdBy.name,
  header: sortableHeader('Registró'),
  cell: ({ row }) => row.original.createdBy.name
}, {
  accessorKey: 'amount',
  header: sortableHeader('Importe', 'right'),
  cell: ({ row }) => h(
    'div',
    { class: 'text-right font-semibold text-highlighted' },
    formatCurrency(row.original.amount, row.original.currencyCode)
  )
}]
</script>

<template>
  <div class="flex flex-col gap-3 md:hidden" :aria-busy="loading">
    <template v-if="loading">
      <UCard
        v-for="index in 3"
        :key="index"
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
      >
        <div class="flex items-center justify-between gap-4">
          <USkeleton class="h-5 w-24" />
          <USkeleton class="h-5 w-24" />
        </div>
        <USkeleton class="h-4 w-full" />
        <USkeleton class="h-4 w-2/3" />
      </UCard>
      <span class="sr-only" role="status">Cargando gastos…</span>
    </template>

    <template v-else-if="expenses.length">
      <UCard
        v-for="expense in expenses"
        :key="expense.id"
        :ui="{ body: 'flex flex-col gap-4 p-4 sm:p-4' }"
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

  <AppTableSkeleton
    v-if="loading"
    :cols="columns.length"
    class="hidden shrink-0 md:block"
  />

  <UTable
    v-else
    v-model:sorting="sorting"
    :data="tableExpenses"
    :columns="columns"
    empty="No hay gastos para mostrar."
    class="hidden shrink-0 md:block"
    :ui="{
      base: 'min-w-full border-separate border-spacing-0',
      thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
      tbody: '[&>tr]:last:[&>td]:border-b-0',
      th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
      td: 'border-b border-default',
      separator: 'h-0'
    }"
  />
</template>
