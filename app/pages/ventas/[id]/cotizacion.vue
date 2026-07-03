<script setup lang="ts">
import type { SalesOrderDetail } from '~/types/orders'

definePageMeta({ layout: false })

const route = useRoute()
const orderId = computed(() => String(route.params.id))
const documentRef = ref<HTMLElement | null>(null)
const downloading = shallowRef(false)

const { data: order, status, error } = useLazyFetch<SalesOrderDetail>(
  () => `/api/orders/${encodeURIComponent(orderId.value)}`,
  { key: () => `sales-order-print-${orderId.value}` }
)

const isQuote = computed(() => order.value?.status.key === 'borrador')
const docLabel = computed(() => isQuote.value ? 'Cotización' : 'Pedido')

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

useSeoMeta({ title: () => order.value ? `${docLabel.value} ${order.value.number}` : 'Documento' })

function printDocument() {
  window.print()
}

async function downloadPdf() {
  if (!documentRef.value || !order.value || downloading.value) return
  downloading.value = true
  try {
    const html2pdf = (await import('html2pdf.js')).default
    await html2pdf().set({
      margin: 0,
      filename: `${docLabel.value}-${order.value.number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(documentRef.value).save()
  } finally {
    downloading.value = false
  }
}

// The document tab is opened from the order detail with ?action=print|pdf to
// trigger the action once the document is rendered. No on-page controls, so the
// tab is a clean client-facing document.
const autoRan = shallowRef(false)
watch([status, order], () => {
  if (!import.meta.client || autoRan.value) return
  if (status.value !== 'success' || !order.value) return
  const action = route.query.action
  if (action !== 'print' && action !== 'pdf') return
  autoRan.value = true
  nextTick(() => action === 'print' ? printDocument() : downloadPdf())
}, { immediate: true })
</script>

<template>
  <div class="page">
    <UAlert
      v-if="error"
      class="mx-auto max-w-3xl"
      color="warning"
      variant="subtle"
      title="Documento no disponible"
      :description="error.data?.statusMessage || 'No fue posible cargar el pedido.'"
      icon="i-lucide-database-zap"
    />

    <p v-else-if="status === 'pending'" class="mt-10 text-center text-sm text-muted">
      Cargando documento…
    </p>

    <!-- Captured for PDF: plain CSS only (no oklch/Tailwind color utilities). -->
    <div v-else-if="order" ref="documentRef" class="quote-doc">
      <header class="doc-head">
        <div>
          <p class="brand">
            Carolina Pinturas
          </p>
          <p class="brand-sub">
            Distribuidor Siigo México
          </p>
        </div>
        <div class="doc-meta">
          <p class="doc-type">
            {{ docLabel === 'Cotización' ? 'COTIZACIÓN' : 'PEDIDO' }}
          </p>
          <p class="doc-number">
            {{ order.number }}
          </p>
          <p class="doc-date">
            {{ isQuote ? 'Fecha de cotización' : 'Fecha del pedido' }}: {{ formatDate(order.orderDate) }}
          </p>
        </div>
      </header>

      <section class="doc-party">
        <p class="party-label">
          Cliente
        </p>
        <p class="party-name">
          {{ order.customer.name }}
        </p>
        <p class="party-line">
          RFC: {{ order.customer.rfc || '—' }}
        </p>
      </section>

      <table class="items">
        <thead>
          <tr>
            <th class="c-code">
              Código
            </th>
            <th class="c-name">
              Concepto
            </th>
            <th class="c-num">
              Cant.
            </th>
            <th class="c-num">
              P. unitario
            </th>
            <th class="c-num">
              Importe
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in order.items" :key="item.id">
            <td class="c-code">
              {{ item.code }}
            </td>
            <td class="c-name">
              {{ item.name }}
              <span v-if="item.observations" class="item-note">{{ item.observations }}</span>
            </td>
            <td class="c-num">
              {{ item.quantity }}
            </td>
            <td class="c-num">
              {{ formatCurrency(item.unitPrice) }}
            </td>
            <td class="c-num">
              {{ formatCurrency(item.total) }}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="totals-wrap">
        <table class="totals">
          <tbody>
            <tr>
              <td class="t-label">
                Subtotal
              </td>
              <td class="t-value">
                {{ formatCurrency(order.subtotal) }}
              </td>
            </tr>
            <tr>
              <td class="t-label">
                Impuestos
              </td>
              <td class="t-value">
                {{ formatCurrency(order.taxTotal) }}
              </td>
            </tr>
            <tr class="t-grand">
              <td class="t-label">
                Total
              </td>
              <td class="t-value">
                {{ formatCurrency(order.total) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section v-if="order.observations" class="doc-notes">
        <p class="notes-label">
          Observaciones
        </p>
        <p class="notes-body">
          {{ order.observations }}
        </p>
      </section>

      <footer class="doc-foot">
        <p v-if="isQuote" class="foot-terms">
          Cotización válida por 15 días a partir de la fecha de emisión. Precios sujetos a
          cambio sin previo aviso.
        </p>
        <p class="foot-thanks">
          Gracias por su preferencia.
        </p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #f4f4f5;
  padding: 24px 16px;
}

/* The printable document uses fixed hex colors so window.print() and
   html2canvas (PDF) render identically and avoid unsupported oklch colors. */
.quote-doc {
  max-width: 800px;
  margin: 0 auto;
  background: #ffffff;
  color: #111827;
  padding: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
}

.doc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  border-bottom: 2px solid #111827;
  padding-bottom: 16px;
}

.brand {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.brand-sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.doc-meta {
  text-align: right;
}

.doc-type {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #1d4ed8;
}

.doc-number {
  font-size: 14px;
  font-weight: 600;
  margin-top: 2px;
}

.doc-date {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.doc-party {
  margin-top: 24px;
}

.party-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.party-name {
  font-size: 15px;
  font-weight: 600;
  margin-top: 2px;
}

.party-line {
  color: #374151;
}

.items {
  width: 100%;
  border-collapse: collapse;
  margin-top: 24px;
}

.items th {
  background: #f3f4f6;
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #374151;
  padding: 8px 10px;
  border-bottom: 1px solid #d1d5db;
}

.items td {
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}

.c-num {
  text-align: right;
  white-space: nowrap;
}

.c-code {
  white-space: nowrap;
  color: #374151;
}

.item-note {
  display: block;
  font-size: 11px;
  color: #6b7280;
}

.totals-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.totals {
  width: 260px;
  border-collapse: collapse;
}

.totals td {
  padding: 6px 10px;
}

.t-label {
  color: #6b7280;
}

.t-value {
  text-align: right;
  font-weight: 600;
}

.t-grand td {
  border-top: 2px solid #111827;
  font-size: 15px;
}

.t-grand .t-label {
  color: #111827;
  font-weight: 700;
}

.doc-notes {
  margin-top: 24px;
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.notes-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
}

.notes-body {
  margin-top: 4px;
  white-space: pre-wrap;
}

.doc-foot {
  margin-top: 32px;
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
  font-size: 12px;
  color: #6b7280;
}

.foot-terms {
  margin-top: 8px;
}

.foot-thanks {
  margin-top: 8px;
}

@media print {
  .page {
    background: #ffffff;
    padding: 0;
  }

  .quote-doc {
    max-width: none;
    margin: 0;
    border: none;
    border-radius: 0;
    padding: 0;
  }
}
</style>
