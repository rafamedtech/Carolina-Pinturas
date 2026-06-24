<script setup lang="ts">
import { h } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { SiigoCustomer, SiigoInvoiceDetail } from '~/types/siigo'

type InvoiceItem = NonNullable<SiigoInvoiceDetail['items']>[number]

const route = useRoute()
const invoiceId = computed(() => String(route.params.id))
const { data: invoice, status, error, refresh } = useLazyFetch<SiigoInvoiceDetail>(
  () => `/api/siigo/invoices/${encodeURIComponent(invoiceId.value)}`,
  { key: () => `siigo-invoice-${invoiceId.value}` }
)
const customerId = computed(() => invoice.value?.customer?.id)
const { data: customerDetail, refresh: refreshCustomer, clear: clearCustomer } = useLazyFetch<SiigoCustomer>(
  () => `/api/siigo/customers/${encodeURIComponent(customerId.value || '')}`,
  { immediate: false, key: () => `siigo-invoice-customer-${customerId.value || 'empty'}` }
)

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const invoiceName = computed(() => invoice.value?.name || 'Detalle de factura')
const customer = computed(() => invoice.value?.customer)
const customerIdentifier = computed(() => customer.value?.rfc_id || customer.value?.identification || '—')
const customerName = computed(() => {
  const name = customerDetail.value?.name
  if (Array.isArray(name)) return name.filter(Boolean).join(' ')
  return typeof name === 'string' ? name : ''
})
const paymentConditions = computed(() => invoice.value?.payment?.conditions || [])
const observations = computed(() => invoice.value?.observations?.trim() || '')
const hasAdditionalInfo = computed(() => paymentConditions.value.length > 0 || Boolean(observations.value))
const message = computed(() => error.value?.data?.statusMessage || 'No fue posible cargar la factura.')
const itemColumns: TableColumn<InvoiceItem>[] = [{
  accessorKey: 'code',
  header: 'Código',
  cell: ({ row }) => row.getValue('code') || '—'
}, {
  accessorKey: 'description',
  header: 'Descripción',
  cell: ({ row }) => row.getValue('description') || '—'
}, {
  accessorKey: 'quantity',
  header: 'Cantidad',
  cell: ({ row }) => row.getValue('quantity') || '—'
}, {
  accessorKey: 'price',
  header: 'Precio unitario',
  cell: ({ row }) => formatCurrency(Number(row.getValue('price') || 0))
}, {
  accessorKey: 'total',
  header: () => h('div', { class: 'text-right' }, 'Total'),
  cell: ({ row }) => h('div', { class: 'text-right font-medium' }, formatCurrency(Number(row.getValue('total') || 0)))
}]

function formatCurrency(value?: number) {
  return currency.format(value || 0)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/')
  return new Date(value).toLocaleDateString('es-MX')
}

watch(customerId, (id) => {
  if (!id) {
    clearCustomer()
    return
  }

  refreshCustomer()
}, { immediate: true })

async function refreshInvoiceDetail() {
  await refresh()
  if (customerId.value) await refreshCustomer()
}
</script>

<template>
  <UDashboardPanel id="invoice-detail">
    <template #header>
      <UDashboardNavbar :title="invoiceName">
        <template #leading>
          <UButton
            to="/ventas"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            aria-label="Volver a ventas"
          />
        </template>
        <template #right>
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="status === 'pending'"
            @click="refreshInvoiceDetail"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="warning"
        variant="subtle"
        title="Factura no disponible"
        :description="message"
        icon="i-lucide-plug-zap"
      />

      <template v-else-if="invoice">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p class="text-sm text-muted">
              Factura
            </p>
            <h1 class="text-xl font-semibold text-highlighted">
              {{ invoice.name }}
            </h1>
            <p class="mt-1 text-sm text-muted">
              {{ formatDate(invoice.date) }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-sm text-muted">
              Total
            </p>
            <p class="text-xl font-semibold text-highlighted">
              {{ formatCurrency(invoice.total) }}
            </p>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Cliente y comprobante
              </h2>
            </template>
            <dl class="grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-muted">
                  Cliente
                </dt>
                <dd class="mt-1 font-medium">
                  {{ customerName || customerIdentifier }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  RFC
                </dt>
                <dd class="mt-1 font-medium">
                  {{ customerIdentifier }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Uso CFDI
                </dt>
                <dd class="mt-1 font-medium">
                  {{ invoice.use?.name || invoice.use?.code || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Saldo pendiente
                </dt>
                <dd class="mt-1 font-medium">
                  {{ formatCurrency(invoice.balance) }}
                </dd>
              </div>
            </dl>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="font-semibold text-highlighted">
                Pago
              </h2>
            </template>
            <dl class="grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-muted">
                  Método
                </dt>
                <dd class="mt-1 font-medium">
                  {{ invoice.payment?.method || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Forma CFDI
                </dt>
                <dd class="mt-1 font-medium">
                  {{ invoice.payment?.cfdi || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Estatus
                </dt>
                <dd class="mt-1 font-medium">
                  {{ invoice.payment?.paid ? 'Pagada' : 'Pendiente' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-muted">
                  Fecha de creación
                </dt>
                <dd class="mt-1 font-medium">
                  {{ formatDate(invoice.metadata?.created) }}
                </dd>
              </div>
            </dl>
          </UCard>
        </div>

        <UCard class="shrink-0" :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Partidas
            </h2>
          </template>
          <UTable
            :data="invoice.items || []"
            :columns="itemColumns"
            empty="La factura no tiene partidas para mostrar."
          />
        </UCard>

        <UCard v-if="hasAdditionalInfo" class="shrink-0">
          <template #header>
            <h2 class="font-semibold text-highlighted">
              Información adicional
            </h2>
          </template>
          <div class="grid gap-4 lg:grid-cols-2">
            <div v-if="paymentConditions.length" class="min-w-0">
              <p class="text-sm text-muted">
                Condiciones de pago
              </p>
              <ul class="mt-2 space-y-2">
                <li v-for="condition in paymentConditions" :key="condition.id" class="grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-sm">
                  <span class="min-w-0 break-words">{{ condition.name || 'Condición' }}</span>
                  <span class="font-medium whitespace-nowrap">{{ formatCurrency(condition.value) }}</span>
                </li>
              </ul>
            </div>
            <div v-if="observations" class="min-w-0">
              <p class="text-sm text-muted">
                Observaciones
              </p>
              <p class="mt-2 whitespace-pre-wrap break-words">
                {{ observations }}
              </p>
            </div>
          </div>
        </UCard>
      </template>

      <div v-else-if="status === 'pending'" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
      </div>
    </template>
  </UDashboardPanel>
</template>
