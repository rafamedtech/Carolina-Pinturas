<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SiigoInvoice, SiigoListResponse } from '~/types/siigo'

const UBadge = resolveComponent('UBadge')
const { data: invoices, status: invoiceStatus, error: invoiceError, refresh: refreshInvoices } = await useFetch<SiigoListResponse<SiigoInvoice>>('/api/siigo/invoices', { lazy: true })
const { data: vouchers, status: voucherStatus, error: voucherError, refresh: refreshVouchers } = await useFetch<SiigoListResponse<SiigoInvoice>>('/api/siigo/vouchers', { lazy: true })

const columns: TableColumn<SiigoInvoice>[] = [{
  accessorKey: 'name',
  header: 'Documento',
  cell: ({ row }) => row.getValue('name') || row.original.id
}, {
  accessorKey: 'date',
  header: 'Fecha',
  cell: ({ row }) => row.getValue('date') ? new Date(String(row.getValue('date'))).toLocaleDateString('es-MX') : '—'
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
  cell: ({ row }) => h('div', { class: 'text-right font-medium' }, new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(row.getValue('total') || 0)))
}]

const invoiceMessage = computed(() => invoiceError.value?.data?.statusMessage || 'No fue posible cargar las facturas.')
const voucherMessage = computed(() => voucherError.value?.data?.statusMessage || 'No fue posible cargar las recepciones de pago.')
</script>

<template>
  <UDashboardPanel id="sales">
    <template #header>
      <UDashboardNavbar title="Ventas">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Nueva factura"
            icon="i-lucide-file-plus-2"
            disabled
            title="Se habilita tras validar las operaciones de Siigo México."
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        color="warning"
        variant="subtle"
        title="Operaciones fiscales protegidas"
        description="La emisión, cancelación y envío de facturas se habilitarán cuando validemos el contrato de Siigo México y cuentes con un ambiente seguro de prueba."
        icon="i-lucide-shield-check"
      />

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-semibold text-highlighted">
              Facturas
            </h2>
            <UButton
              label="Actualizar"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="invoiceStatus === 'pending'"
              @click="() => refreshInvoices()"
            />
          </div>
        </template>
        <UAlert
          v-if="invoiceError"
          color="warning"
          variant="subtle"
          :description="invoiceMessage"
          class="m-4"
        />
        <UTable
          v-else
          :data="invoices?.results || []"
          :columns="columns"
          :loading="invoiceStatus === 'pending'"
          empty="No hay facturas para mostrar."
        />
      </UCard>

      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-semibold text-highlighted">
              Recepciones de pago
            </h2>
            <UButton
              label="Actualizar"
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="voucherStatus === 'pending'"
              @click="() => refreshVouchers()"
            />
          </div>
        </template>
        <UAlert
          v-if="voucherError"
          color="warning"
          variant="subtle"
          :description="voucherMessage"
          class="m-4"
        />
        <UTable
          v-else
          :data="vouchers?.results || []"
          :columns="columns"
          :loading="voucherStatus === 'pending'"
          empty="No hay recepciones de pago para mostrar."
        />
      </UCard>
    </template>
  </UDashboardPanel>
</template>
