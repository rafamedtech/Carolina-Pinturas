// Structural subset of SalesOrderDetail (app/types/orders.ts). Shared code
// cannot import app types, but SalesOrderDetail satisfies these shapes.
export interface TicketOrderItem {
  position: number
  name: string
  quantity: number
  unitPrice: number
  discountAmount: number
  total: number
  unit: { code: string | null, name: string | null }
}

export interface TicketOrder {
  number: string
  orderDate: string
  status: { key: string, label: string }
  customer: {
    name: string
    rfc: string | null
    phone: string | null
    address: string | null
  }
  paymentStatus: string
  paymentMethod: string | null
  currencyCode: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  taxBreakdown: Array<{ name: string, percentage: number | null, amount: number }>
  observations: string | null
  items: TicketOrderItem[]
}

export interface TicketPrintOptions {
  charsPerLine: number
}

export type TicketPaperWidth = 62 | 80

export const TICKET_DEFAULT_CHARS: Record<TicketPaperWidth, number> = {
  62: 42,
  80: 48
}
