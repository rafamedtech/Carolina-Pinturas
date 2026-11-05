import type { PurchaseView } from '~/types/purchases'
import { formatDate } from './datetime'
import { purchaseQuantity, purchaseStatus } from './purchaseFormat'

// Only supplier-facing fields enter the document generator.
export type SupplierPurchaseOrder = Pick<PurchaseView, 'folio' | 'date' | 'status' | 'providerName' | 'providerRfc'> & {
  items: Array<Pick<PurchaseView['items'][number], 'code' | 'name' | 'quantity'>>
}

export async function createPurchaseSupplierPdf(order: SupplierPurchaseOrder) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const left = 16
  const right = 194
  const bottom = 277
  let y = 20

  pdf.setProperties({ title: `Orden de compra OC-${order.folio}`, subject: 'Orden para proveedor sin precios' })

  function newPage() {
    pdf.addPage()
    y = 20
  }

  function text(value: string, size = 10, bold = false) {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    const lines = pdf.splitTextToSize(value, right - left) as string[]
    for (const line of lines) {
      if (y > bottom) newPage()
      pdf.text(line, left, y)
      y += size * 0.45
    }
    y += 3
  }

  text(`Orden de compra OC-${order.folio}`, 18, true)
  text('Carolina Pinturas', 12)
  text(`Fecha: ${formatDate(order.date)} · Estado: ${purchaseStatus(order.status).label}`)
  y += 3
  text('Proveedor', 10, true)
  text(order.providerName, 12)
  if (order.providerRfc) text(`RFC: ${order.providerRfc}`)
  y += 4

  function tableHeader() {
    pdf.setFillColor(243, 244, 246)
    pdf.rect(left, y, right - left, 9, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('Código', left + 2, y + 6)
    pdf.text('Producto', left + 40, y + 6)
    pdf.text('Cantidad', right - 2, y + 6, { align: 'right' })
    y += 9
    pdf.setFont('helvetica', 'normal')
  }

  tableHeader()
  for (const item of order.items) {
    pdf.setFontSize(9)
    const codes = pdf.splitTextToSize(item.code, 34) as string[]
    const names = pdf.splitTextToSize(item.name, 104) as string[]
    const quantities = pdf.splitTextToSize(purchaseQuantity(item.quantity), 28) as string[]
    const lines = Math.max(codes.length, names.length, quantities.length)
    const rowHeight = Math.max(10, lines * 5 + 4)
    if (y + Math.min(rowHeight, 237) > bottom) {
      newPage()
      tableHeader()
    }
    for (let index = 0; index < lines; index++) {
      if (y + 7 > bottom) {
        newPage()
        tableHeader()
      }
      if (codes[index]) pdf.text(codes[index]!, left + 2, y + 6)
      if (names[index]) pdf.text(names[index]!, left + 40, y + 6)
      if (quantities[index]) pdf.text(quantities[index]!, right - 2, y + 6, { align: 'right' })
      y += 5
    }
    y += 4
    pdf.setDrawColor(220)
    pdf.line(left, y, right, y)
  }

  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page)
    pdf.setFontSize(8)
    pdf.text(`OC-${order.folio} · Página ${page} de ${pages}`, right, 287, { align: 'right' })
  }
  return pdf
}
