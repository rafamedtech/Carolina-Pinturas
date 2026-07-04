import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
import type { TicketOrder, TicketPrintOptions } from '../types/ticket'
import { BUSINESS_INFO } from './businessInfo'

// Local copies of the payment labels (app/utils/orderPayment.ts): shared code
// cannot import from app/, and the builder also runs server-side.
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pendiente_pago: 'Pendiente de pago',
  pago_recibido: 'Pago recibido'
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta'
}

function formatTicketDate(value: string) {
  return value.split('-').reverse().join('/')
}

function formatTaxLabel(tax: TicketOrder['taxBreakdown'][number]) {
  if (tax.percentage === null) return tax.name

  const name = tax.name.replace(/\s*\d+(?:[.,]\d+)?\s*%\s*$/u, '').trim()
  return `${name || 'Impuesto'} (${tax.percentage}%)`
}

export function buildTicketBytes(order: TicketOrder, options: TicketPrintOptions) {
  const columns = options.charsPerLine
  const currency = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: order.currencyCode || 'MXN'
  })
  const money = (value: number) => currency.format(value || 0)

  // Two-column row: left text wraps, amounts stay right-aligned.
  const amountWidth = 14
  const rowColumns = [
    { width: columns - amountWidth, align: 'left' as const },
    { width: amountWidth, align: 'right' as const }
  ]
  const row = (label: string, value: string) => [[label, value]]

  const isQuote = order.status.key === 'borrador'
  const encoder = new ReceiptPrinterEncoder({ columns })
    .initialize()
    .codepage('auto')

  encoder
    .align('center')
    .bold(true)
    .line(BUSINESS_INFO.name.toUpperCase())
    .line(BUSINESS_INFO.legalName)
    .line(`R.F.C. ${BUSINESS_INFO.rfc}`)

  for (const addressLine of BUSINESS_INFO.addressLines) {
    encoder.line(addressLine)
  }
  encoder
    .line(`Tel: ${BUSINESS_INFO.phone}`)
    .line(BUSINESS_INFO.email)
    .rule({ style: 'dashed' })
    .line(isQuote ? 'COTIZACIÓN' : 'NOTA DE VENTA')
    .align('left')
    .line(`Folio: ${order.number}`)
    .line(`Fecha: ${formatTicketDate(order.orderDate)}`)
    .line(`Cliente: ${order.customer.name}`)

  if (order.customer.rfc) {
    encoder.line(`RFC: ${order.customer.rfc}`)
  }
  if (order.customer.phone) {
    encoder.line(`Teléfono: ${order.customer.phone}`)
  }
  if (order.customer.address) {
    encoder.line(`Domicilio: ${order.customer.address}`)
  }

  encoder.rule({ style: 'dashed' })

  for (const item of order.items) {
    const unit = item.unit.name || item.unit.code || ''
    const quantityLabel = `${item.quantity}${unit ? ` ${unit}` : ''} x ${money(item.unitPrice)}`
    encoder
      .line(item.name)
      .table(rowColumns, row(quantityLabel, money(item.total)))
    if (item.discountAmount > 0) {
      encoder.table(rowColumns, row('  Desc:', `-${money(item.discountAmount)}`))
    }
  }

  encoder
    .rule({ style: 'dashed' })
    .table(rowColumns, row('Subtotal', money(order.subtotal)))

  if (order.discountTotal > 0) {
    encoder.table(rowColumns, row('Descuento', `-${money(order.discountTotal)}`))
  }

  for (const tax of order.taxBreakdown) {
    encoder.table(rowColumns, row(formatTaxLabel(tax), money(tax.amount)))
  }

  encoder
    .align('right')
    .bold(true)
    .size(2, 2)
    .line(`TOTAL ${money(order.total)}`)
    .size(1, 1)
    .align('left')

  if (!isQuote) {
    encoder
      .newline()
      .line(`Pago: ${PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}`)
    if (order.paymentMethod) {
      encoder.line(`Método: ${PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}`)
    }
  }

  if (order.observations) {
    encoder
      .newline()
      .line(`Obs: ${order.observations}`)
  }

  encoder
    .newline()
    .align('center')
    .line(BUSINESS_INFO.footerMessage)

  encoder.align('left')
  for (const businessHoursLine of BUSINESS_INFO.businessHoursLines) {
    encoder.line(businessHoursLine)
  }

  encoder.align('center')
  for (const footerLine of BUSINESS_INFO.footerLines) {
    encoder.line(footerLine)
  }

  return encoder
    .newline(3)
    .cut()
    .encode()
}
