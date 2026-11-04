import Decimal from 'decimal.js'
import type { PurchaseView, PurchaseInvoiceView } from '~/types/purchases'

export type PayablePeriod = 'all' | 'week' | 'month' | 'overdue'
export type PayableRow = PurchaseInvoiceView & {
  orderId: string
  orderFolio: number
  providerId: string
  providerName: string
  currencyCode: 'MXN' | 'USD'
  daysUntilDue: number
}

export function payableRows(orders: PurchaseView[], today: string): PayableRow[] {
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  return orders.filter(order => order.status !== 'cancelada').flatMap(order => order.invoices
    .filter(invoice => !invoice.voidedAt && invoice.status !== 'anulada')
    .map(invoice => ({
      ...invoice,
      status: invoice.balance <= 0 ? 'liquidada' as const : invoice.dueDate < today ? 'vencida' as const : 'pendiente' as const,
      orderId: order.id,
      orderFolio: order.folio,
      providerId: order.providerId,
      providerName: order.providerName,
      currencyCode: order.currencyCode,
      daysUntilDue: Math.round((Date.parse(`${invoice.dueDate}T00:00:00Z`) - todayMs) / 86400000)
    })))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.balance - a.balance)
}

export function payablePeriodEnd(today: string, period: 'week' | 'month') {
  const date = new Date(`${today}T00:00:00Z`)
  if (period === 'week') date.setUTCDate(date.getUTCDate() + (7 - date.getUTCDay()) % 7)
  else date.setUTCMonth(date.getUTCMonth() + 1, 0)
  return date.toISOString().slice(0, 10)
}

export function inPayablePeriod(row: PayableRow, period: PayablePeriod, today: string) {
  if (period === 'all') return true
  if (row.balance <= 0) return false
  if (period === 'overdue') return row.dueDate < today
  return row.dueDate >= today && row.dueDate <= payablePeriodEnd(today, period)
}

export function payableBalance(rows: Pick<PayableRow, 'balance'>[]) {
  return rows.reduce((sum, row) => sum.plus(row.balance), new Decimal(0)).toNumber()
}

const money = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function payableMoney(amount: number) {
  return `$${money.format(amount)}`
}

export function payableTiming(row: PayableRow) {
  if (row.balance <= 0) return 'Liquidada'
  if (row.daysUntilDue < 0) return `${Math.abs(row.daysUntilDue)} días de atraso`
  if (row.daysUntilDue === 0) return 'Vence hoy'
  if (row.daysUntilDue === 1) return 'Vence mañana'
  return `Vence en ${row.daysUntilDue} días`
}
