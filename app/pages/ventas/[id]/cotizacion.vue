<script setup lang="ts">
import type { SalesOrderDetail } from '~/types/orders'

definePageMeta({ layout: false })

const route = useRoute()
const orderId = computed(() => String(route.params.id))
const downloading = shallowRef(false)
const pdfError = shallowRef('')

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

function formatTaxLabel(tax: SalesOrderDetail['taxBreakdown'][number]) {
  if (tax.percentage === null) return tax.name

  const name = tax.name.replace(/\s*\d+(?:[.,]\d+)?\s*%\s*$/u, '').trim()
  return `${name || 'Impuesto'} (${tax.percentage}%)`
}

const quoteExpiryDate = computed(() => {
  if (!order.value?.orderDate) return null

  const [year, month, day] = order.value.orderDate.split('-').map(Number)
  const expiry = new Date(Date.UTC(year!, month! - 1, day!))
  expiry.setUTCDate(expiry.getUTCDate() + 15)
  return expiry.toISOString().slice(0, 10)
})

useSeoMeta({ title: () => order.value ? docLabel.value : 'Documento' })

function printDocument() {
  window.print()
}

async function imageDataUrl(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`No fue posible cargar la imagen: ${url}`)

  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function downloadPdf() {
  if (!order.value || downloading.value) return
  downloading.value = true
  pdfError.value = ''

  try {
    const [{ jsPDF }, logo] = await Promise.all([
      import('jspdf'),
      imageDataUrl('/logo-pinturas.png')
    ])
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
    const filename = `${docLabel.value}-${order.value.orderDate}.pdf`
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const left = 16
    const right = pageWidth - 16
    const contentWidth = right - left
    let y = 12

    pdf.setProperties({ title: docLabel.value, subject: 'Cotización para cliente' })
    pdf.addImage(logo, 'PNG', left, y, 54, 27)
    pdf.setTextColor(29, 78, 216)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text(docLabel.value.toUpperCase(), right, y + 9, { align: 'right' })
    pdf.setTextColor(107, 114, 128)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(`Fecha de cotización: ${formatDate(order.value.orderDate)}`, right, y + 17, {
      align: 'right'
    })
    pdf.text(`Válida hasta: ${formatDate(quoteExpiryDate.value)}`, right, y + 22, {
      align: 'right'
    })
    y += 32
    pdf.setDrawColor(17, 24, 39)
    pdf.setLineWidth(0.7)
    pdf.line(left, y, right, y)

    y += 8
    pdf.setTextColor(107, 114, 128)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.text('CLIENTE', left, y)
    y += 6
    pdf.setTextColor(17, 24, 39)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'bold')
    pdf.text(order.value.customer.name, left, y)
    y += 10

    const drawTableHeader = () => {
      pdf.setFillColor(243, 244, 246)
      pdf.rect(left, y, contentWidth, 8, 'F')
      pdf.setTextColor(55, 65, 81)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.text('CÓDIGO', left + 2, y + 5.2)
      pdf.text('CONCEPTO', left + 34, y + 5.2)
      pdf.text('CANT.', left + 126, y + 5.2, { align: 'right' })
      pdf.text('P. UNITARIO', left + 153, y + 5.2, { align: 'right' })
      pdf.text('IMPORTE', right - 2, y + 5.2, { align: 'right' })
      y += 8
    }

    const addItemsPage = () => {
      pdf.addPage()
      y = 16
      drawTableHeader()
    }

    drawTableHeader()
    pdf.setFont('helvetica', 'normal')

    for (const item of order.value.items) {
      const nameLines = pdf.splitTextToSize(item.name, 84) as string[]
      const rowHeight = Math.max(9, nameLines.length * 4 + 4)
      if (y + rowHeight > pageHeight - 20) addItemsPage()

      pdf.setTextColor(55, 65, 81)
      pdf.setFontSize(8.5)
      pdf.text(item.code, left + 2, y + 5.5)
      pdf.setTextColor(17, 24, 39)
      pdf.text(nameLines, left + 34, y + 5.5)
      pdf.text(String(item.quantity), left + 126, y + 5.5, { align: 'right' })
      pdf.text(formatCurrency(item.unitPrice), left + 153, y + 5.5, { align: 'right' })
      pdf.setFont('helvetica', 'bold')
      pdf.text(formatCurrency(item.total), right - 2, y + 5.5, { align: 'right' })
      pdf.setFont('helvetica', 'normal')
      pdf.setDrawColor(229, 231, 235)
      pdf.setLineWidth(0.2)
      pdf.line(left, y + rowHeight, right, y + rowHeight)
      y += rowHeight
    }

    const totalsHeight = 20 + order.value.taxBreakdown.length * 6
    if (y + totalsHeight > pageHeight - 25) {
      pdf.addPage()
      y = 20
    } else {
      y += 7
    }

    const totalsLabelX = right - 55
    pdf.setFontSize(9)
    pdf.setTextColor(107, 114, 128)
    pdf.text('Subtotal', totalsLabelX, y)
    pdf.setTextColor(17, 24, 39)
    pdf.text(formatCurrency(order.value.subtotal), right, y, { align: 'right' })

    for (const tax of order.value.taxBreakdown) {
      y += 6
      pdf.setTextColor(107, 114, 128)
      pdf.text(formatTaxLabel(tax), totalsLabelX, y)
      pdf.setTextColor(17, 24, 39)
      pdf.text(formatCurrency(tax.amount), right, y, { align: 'right' })
    }

    y += 8
    pdf.setDrawColor(17, 24, 39)
    pdf.setLineWidth(0.5)
    pdf.line(totalsLabelX, y - 4, right, y - 4)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('Total', totalsLabelX, y)
    pdf.text(formatCurrency(order.value.total), right, y, { align: 'right' })

    y += 18
    if (y > pageHeight - 28) {
      pdf.addPage()
      y = 20
    }
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8.5)
    pdf.setTextColor(107, 114, 128)
    const terms = pdf.splitTextToSize(
      'Cotización válida por 15 días a partir de la fecha de emisión. '
      + 'Precios sujetos a cambio sin previo aviso.',
      contentWidth
    ) as string[]
    pdf.text(terms, left, y)
    y += terms.length * 4 + 4
    pdf.text('Gracias por su preferencia.', left, y)

    const pdfBlob = pdf.output('blob')

    const downloadUrl = URL.createObjectURL(pdfBlob)
    const downloadLink = document.createElement('a')
    downloadLink.href = downloadUrl
    downloadLink.download = filename
    document.body.appendChild(downloadLink)
    downloadLink.click()
    downloadLink.remove()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  } catch (pdfGenerationError) {
    console.error('No fue posible generar la cotización en PDF.', pdfGenerationError)
    pdfError.value = 'No fue posible descargar el PDF. Intenta de nuevo.'
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

    <div v-else-if="order" class="document-actions">
      <UButton
        label="Imprimir"
        icon="i-lucide-printer"
        color="neutral"
        variant="outline"
        @click="printDocument"
      />
      <UButton
        label="Descargar PDF"
        icon="i-lucide-download"
        :loading="downloading"
        @click="downloadPdf"
      />
      <p v-if="pdfError" class="pdf-error" role="alert">
        {{ pdfError }}
      </p>
    </div>

    <!-- Captured for PDF: plain CSS only (no oklch/Tailwind color utilities). -->
    <div v-if="order" class="quote-doc">
      <header class="doc-head">
        <img
          src="/logo-pinturas.png"
          alt="Carolina Pinturas"
          class="brand-logo"
        >
        <div class="doc-meta">
          <p class="doc-type">
            {{ docLabel === 'Cotización' ? 'COTIZACIÓN' : 'PEDIDO' }}
          </p>
          <p class="doc-date">
            {{ isQuote ? 'Fecha de cotización' : 'Fecha del pedido' }}: {{ formatDate(order.orderDate) }}
          </p>
          <p class="doc-date">
            Válida hasta: {{ formatDate(quoteExpiryDate) }}
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
            <tr
              v-for="tax in order.taxBreakdown"
              :key="`${tax.name}-${tax.percentage}`"
            >
              <td class="t-label">
                {{ formatTaxLabel(tax) }}
              </td>
              <td class="t-value">
                {{ formatCurrency(tax.amount) }}
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

.document-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  max-width: 800px;
  margin: 0 auto 12px;
}

.pdf-error {
  flex-basis: 100%;
  margin: 0;
  color: #b91c1c;
  text-align: right;
}

/* Fixed colors keep the browser print version consistent with the generated PDF. */
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
  align-items: center;
  gap: 24px;
  border-bottom: 2px solid #111827;
  padding-bottom: 16px;
}

.brand-logo {
  display: block;
  width: 180px;
  height: auto;
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

  .document-actions {
    display: none;
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
