<script setup lang="ts">
import type { SalesOrderDetail } from '~/types/orders'
import { BUSINESS_INFO } from '#shared/utils/businessInfo'
import type { TicketPaperWidth } from '#shared/types/ticket'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const orderId = computed(() => String(route.params.id))
const { settings } = usePrinterSettings()

const paperWidth = computed<TicketPaperWidth>(() =>
  String(route.query.width) === '62' ? 62 : String(route.query.width) === '80' ? 80 : settings.value.paperWidth)

const { data: order, status, error } = useLazyFetch<SalesOrderDetail>(
  () => `/api/orders/${encodeURIComponent(orderId.value)}`,
  { key: () => `sales-order-ticket-${orderId.value}` }
)

const isQuote = computed(() => order.value?.status.key === 'borrador')

const currency = computed(() => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: order.value?.currencyCode || 'MXN'
}))

function formatCurrency(value: number | undefined) {
  return currency.value.format(value || 0)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return value.split('-').reverse().join('/')
}

function formatTaxLabel(tax: SalesOrderDetail['taxBreakdown'][number]) {
  if (tax.percentage === null) return tax.name

  const name = tax.name.replace(/\s*\d+(?:[.,]\d+)?\s*%\s*$/u, '').trim()
  return `${name || 'Impuesto'} (${tax.percentage}%)`
}

function itemUnit(item: SalesOrderDetail['items'][number]) {
  return item.unit.code || item.unit.name || ''
}

useSeoMeta({ title: () => order.value ? `Ticket ${order.value.number}` : 'Ticket' })

// @page cannot be parameterized from scoped CSS, so the paper size rule is
// injected in the head based on the selected width.
useHead({
  style: [{
    key: 'ticket-page-size',
    innerHTML: computed(() => `@page { size: ${paperWidth.value}mm auto; margin: 0; }`)
  }]
})

function setWidth(width: TicketPaperWidth) {
  router.replace({ query: { ...route.query, width: String(width) } })
}

function printTicket() {
  window.print()
}

// Opened from the order detail with ?action=print to fire the dialog once the
// ticket is rendered.
const autoRan = shallowRef(false)
watch([status, order], () => {
  if (!import.meta.client || autoRan.value) return
  if (status.value !== 'success' || !order.value) return
  if (route.query.action !== 'print') return
  autoRan.value = true
  nextTick(() => printTicket())
}, { immediate: true })
</script>

<template>
  <div class="page">
    <UAlert
      v-if="error"
      class="mx-auto max-w-3xl"
      color="warning"
      variant="subtle"
      title="Ticket no disponible"
      :description="error.data?.statusMessage || 'No fue posible cargar el pedido.'"
      icon="i-lucide-database-zap"
    />

    <p v-else-if="status === 'pending'" class="mt-10 text-center text-sm text-muted">
      Cargando ticket…
    </p>

    <template v-else-if="order">
      <div class="ticket-actions">
        <UFieldGroup>
          <UButton
            label="62mm"
            color="neutral"
            :variant="paperWidth === 62 ? 'solid' : 'outline'"
            @click="setWidth(62)"
          />
          <UButton
            label="80mm"
            color="neutral"
            :variant="paperWidth === 80 ? 'solid' : 'outline'"
            @click="setWidth(80)"
          />
        </UFieldGroup>
        <UButton
          label="Imprimir"
          icon="i-lucide-printer"
          @click="printTicket"
        />
      </div>

      <!-- Plain CSS with fixed colors so the printed ticket is predictable. -->
      <div class="ticket" :class="paperWidth === 62 ? 'ticket--62' : 'ticket--80'">
        <header class="t-header">
          <img
            src="/logo-pinturas.png"
            alt="Carolina Pinturas"
            class="t-logo"
          >
          <p class="t-business">
            {{ BUSINESS_INFO.legalName }}
          </p>
          <p>R.F.C. {{ BUSINESS_INFO.rfc }}</p>
          <p v-for="line in BUSINESS_INFO.addressLines" :key="line">
            {{ line }}
          </p>
          <p>Tel: {{ BUSINESS_INFO.phone }}</p>
          <p>{{ BUSINESS_INFO.email }}</p>
        </header>

        <div class="t-rule" />

        <p class="t-title">
          {{ isQuote ? 'COTIZACIÓN' : 'NOTA DE VENTA' }}
        </p>
        <p>Folio: {{ order.number }}</p>
        <p>Fecha: {{ formatDate(order.orderDate) }}</p>
        <p>Cliente: {{ order.customer.name }}</p>
        <p v-if="order.customer.rfc">
          RFC: {{ order.customer.rfc }}
        </p>
        <p v-if="order.customer.phone">
          Teléfono: {{ order.customer.phone }}
        </p>
        <p v-if="order.customer.address">
          Domicilio: {{ order.customer.address }}
        </p>

        <div class="t-rule" />

        <div v-for="item in order.items" :key="item.id" class="t-item">
          <p class="t-item-name">
            {{ item.name }}
          </p>
          <div class="t-row">
            <span>{{ item.quantity }}{{ itemUnit(item) ? ` ${itemUnit(item)}` : '' }} x {{ formatCurrency(item.unitPrice) }}</span>
            <span class="t-amount">{{ formatCurrency(item.total) }}</span>
          </div>
          <div v-if="item.discountAmount > 0" class="t-row">
            <span class="t-discount">Desc:</span>
            <span class="t-amount">-{{ formatCurrency(item.discountAmount) }}</span>
          </div>
        </div>

        <div class="t-rule" />

        <div class="t-row">
          <span>Subtotal</span>
          <span class="t-amount">{{ formatCurrency(order.subtotal) }}</span>
        </div>
        <div v-if="order.discountTotal > 0" class="t-row">
          <span>Descuento</span>
          <span class="t-amount">-{{ formatCurrency(order.discountTotal) }}</span>
        </div>
        <div
          v-for="tax in order.taxBreakdown"
          :key="`${tax.name}-${tax.percentage}`"
          class="t-row"
        >
          <span>{{ formatTaxLabel(tax) }}</span>
          <span class="t-amount">{{ formatCurrency(tax.amount) }}</span>
        </div>
        <p class="t-total">
          TOTAL {{ formatCurrency(order.total) }}
        </p>

        <template v-if="!isQuote">
          <p class="t-payment">
            Pago: {{ paymentStatusLabel(order.paymentStatus) }}
          </p>
          <p v-if="order.paymentMethod">
            Método: {{ paymentMethodLabel(order.paymentMethod) }}
          </p>
        </template>

        <p v-if="order.observations" class="t-notes">
          Obs: {{ order.observations }}
        </p>

        <footer class="t-footer">
          <p class="t-thanks">
            {{ BUSINESS_INFO.footerMessage }}
          </p>
          <p v-for="line in BUSINESS_INFO.footerLines" :key="line">
            {{ line }}
          </p>
        </footer>
      </div>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f4f4f5;
  padding: 24px 16px;
}

.ticket-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin: 0 auto 16px;
}

/* Fixed colors + real mm widths keep the printed ticket predictable. */
.ticket {
  margin: 0 auto;
  background: #ffffff;
  color: #111111;
  border: 1px solid #e5e7eb;
  padding: 4mm 2mm;
  font-family: 'Courier New', Courier, monospace;
  line-height: 1.35;
}

.ticket--62 {
  width: 62mm;
  font-size: 10px;
}

.ticket--80 {
  width: 80mm;
  font-size: 11px;
}

.ticket p {
  margin: 0;
  overflow-wrap: anywhere;
}

.t-header {
  text-align: center;
}

.t-logo {
  display: block;
  width: 70%;
  margin: 0 auto 4px;
  filter: grayscale(1);
}

.t-business {
  font-weight: 700;
}

.t-rule {
  border-top: 1px dashed #111111;
  margin: 6px 0;
}

.t-title {
  text-align: center;
  font-weight: 700;
  margin-bottom: 4px !important;
}

.t-item {
  margin-bottom: 4px;
}

.t-item-name {
  overflow-wrap: anywhere;
}

.t-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.t-row .t-amount {
  white-space: nowrap;
}

.t-discount {
  padding-left: 8px;
}

.t-total {
  text-align: right;
  font-weight: 700;
  font-size: 1.5em;
  margin-top: 4px !important;
}

.t-payment {
  margin-top: 8px !important;
}

.t-notes {
  margin-top: 8px !important;
}

.t-footer {
  margin-top: 10px;
  text-align: center;
}

.t-thanks {
  font-weight: 700;
}

@media print {
  .page {
    background: #ffffff;
    padding: 0;
  }

  .ticket-actions {
    display: none;
  }

  .ticket {
    margin: 0;
    border: none;
    width: 100%;
    padding: 2mm;
  }
}
</style>
