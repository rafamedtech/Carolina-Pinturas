<script setup lang="ts">
import { h, resolveComponent, shallowRef } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SiigoInvoice, SiigoListResponse } from '~/types/siigo'

const UBadge = resolveComponent('UBadge')
const NuxtLink = resolveComponent('NuxtLink')
const filter = shallowRef('')
const page = shallowRef(1)
const pageSize = 25
const { data: invoices, status: invoiceStatus, error: invoiceError, refresh: refreshInvoices } = await useFetch<SiigoListResponse<SiigoInvoice>>('/api/siigo/invoices', { lazy: true })

watch(filter, () => {
  page.value = 1
})

const filteredInvoices = computed(() => {
  const value = filter.value.trim().toLowerCase()
  const records = invoices.value?.results || []
  if (!value) return records

  return records.filter((invoice) => {
    const customer = invoice.customer
    return [
      invoice.name,
      invoice.date,
      customer?.name,
      customer?.rfc_id,
      customer?.identification,
      invoice.status
    ].filter(Boolean).join(' ').toLowerCase().includes(value)
  })
})
const visibleInvoices = computed(() => {
  const offset = (page.value - 1) * pageSize
  return filteredInvoices.value.slice(offset, offset + pageSize)
})

const columns: TableColumn<SiigoInvoice>[] = [{
  accessorKey: 'name',
  header: 'Documento',
  cell: ({ row }) => h(
    NuxtLink,
    {
      'to': `/ventas/${encodeURIComponent(row.original.id)}`,
      'class': 'font-medium text-primary hover:underline',
      'aria-label': `Abrir factura ${row.getValue('name') || row.original.id}`
    },
    () => row.getValue('name') || row.original.id
  )
}, {
  accessorKey: 'date',
  header: 'Fecha',
  cell: ({ row }) => row.getValue('date') ? new Date(String(row.getValue('date'))).toLocaleDateString('es-MX') : '—'
}, {
  id: 'customer',
  header: 'Cliente',
  cell: ({ row }) => row.original.customer?.name || row.original.customer?.rfc_id || row.original.customer?.identification || '—'
}, {
  accessorKey: 'status',
  header: 'Estado',
  cell: ({ row }) => h(UBadge, { color: 'neutral', variant: 'subtle' }, () => row.getValue('status') || 'Registrada')
}, {
  accessorKey: 'total',
  header: () => h('div', { class: 'text-right' }, 'Total'),
  cell: ({ row }) => h('div', { class: 'text-right font-medium' }, new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(row.getValue('total') || 0)))
}]

const invoiceMessage = computed(() => invoiceError.value?.data?.statusMessage || 'No fue posible cargar las facturas.')
const totalInvoices = computed(() => filteredInvoices.value.length)
const firstInvoice = computed(() => totalInvoices.value ? ((page.value - 1) * pageSize) + 1 : 0)
const lastInvoice = computed(() => Math.min(page.value * pageSize, totalInvoices.value))
</script>

<template>
  <UDashboardPanel id="sales">
    <template #header>
      <UDashboardNavbar title="Ventas">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UInput
          v-model="filter"
          icon="i-lucide-search"
          placeholder="Buscar factura"
          class="w-full sm:max-w-sm"
        />
        <div class="flex gap-2">
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="invoiceStatus === 'pending'"
            @click="() => refreshInvoices()"
          />
          <UButton
            to="/ventas/nuevo-pedido"
            label="Nuevo pedido"
            icon="i-lucide-shopping-cart"
          />
        </div>
      </div>

      <UAlert
        v-if="invoiceError"
        color="warning"
        variant="subtle"
        title="Facturas no disponibles"
        :description="invoiceMessage"
        icon="i-lucide-plug-zap"
      />

      <UTable
        v-else
        :data="visibleInvoices"
        :columns="columns"
        :loading="invoiceStatus === 'pending'"
        empty="No hay facturas para mostrar."
        class="shrink-0"
        :ui="{
          base: 'table-fixed border-separate border-spacing-0',
          thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0',
          th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
          td: 'border-b border-default',
          separator: 'h-0'
        }"
      >
        <template #loading>
          <div class="flex items-center justify-center gap-2 text-muted" role="status">
            <UIcon name="i-lucide-loader-circle" class="size-5 animate-spin text-primary" />
            <span>Cargando facturas…</span>
          </div>
        </template>
      </UTable>

      <div
        v-if="!invoiceError && totalInvoices > 0"
        class="mt-auto flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-sm text-muted">
          Mostrando {{ firstInvoice }}–{{ lastInvoice }} de {{ totalInvoices }} facturas
        </p>

        <UPagination
          v-model:page="page"
          :total="totalInvoices"
          :items-per-page="pageSize"
          :disabled="invoiceStatus === 'pending'"
          show-edges
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
