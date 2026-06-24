<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SiigoInvoice, SiigoListResponse } from '~/types/siigo'

const UBadge = resolveComponent('UBadge')

const { data, status, error, refresh } = await useFetch<SiigoListResponse<SiigoInvoice>>('/api/siigo/invoices', {
  lazy: true
})

const invoices = computed(() => data.value?.results || [])

const columns: TableColumn<SiigoInvoice>[] = [{
  accessorKey: 'name',
  header: 'Documento',
  cell: ({ row }) => row.getValue('name') || row.original.id
}, {
  accessorKey: 'date',
  header: 'Fecha',
  cell: ({ row }) => row.getValue('date')
    ? new Date(String(row.getValue('date'))).toLocaleDateString('es-MX')
    : '—'
}, {
  id: 'customer',
  header: 'Cliente',
  cell: ({ row }) => row.original.customer?.name || row.original.customer?.identification || '—'
}, {
  accessorKey: 'status',
  header: 'Estado',
  cell: ({ row }) => h(UBadge, { color: 'neutral', variant: 'subtle' }, () => row.getValue('status') || 'Registrada')
}, {
  accessorKey: 'total',
  header: () => h('div', { class: 'text-right' }, 'Total'),
  cell: ({ row }) => h('div', { class: 'text-right font-medium' }, new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(Number(row.getValue('total') || 0)))
}]

const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar las facturas.')
</script>

<template>
  <UCard :ui="{ header: 'px-4 py-3 sm:px-5', body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-highlighted">
            Facturas recientes
          </h2>
          <p class="text-sm text-muted">
            Datos consultados directamente desde Siigo.
          </p>
        </div>
        <UButton
          label="Ver ventas"
          to="/ventas"
          color="neutral"
          variant="outline"
          size="sm"
        />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      :description="message"
      class="m-4"
    >
      <template #actions>
        <UButton
          label="Reintentar"
          color="warning"
          variant="soft"
          size="xs"
          @click="() => refresh()"
        />
      </template>
    </UAlert>

    <UTable
      v-else
      :data="invoices"
      :columns="columns"
      :loading="status === 'pending'"
      empty="No hay facturas para mostrar."
      class="shrink-0"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default'
      }"
    />
  </UCard>
</template>
