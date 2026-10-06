export interface PurchasePaymentView {
  id: string
  date: string
  amount: number
  exchangeRate: number
  method: string
  voidedAt: string | null
  voidReason: string | null
}
export interface PurchaseInvoiceView {
  id: string
  folio: string
  date: string
  dueDate: string
  amount: number
  balance: number
  status: 'pendiente' | 'vencida' | 'liquidada' | 'anulada'
  voidedAt: string | null
  voidReason: string | null
  payments: PurchasePaymentView[]
}
export interface PurchaseView {
  id: string
  folio: number
  status: string
  version: number
  providerId: string
  providerName: string
  providerRfc: string | null
  date: string
  currencyCode: 'MXN' | 'USD'
  total: number
  balance: number
  invoiced: number
  notes: string
  receiptStatus: 'pendiente' | 'parcial' | 'completa'
  items: Array<{ id: string, productId: string, code: string, name: string, quantity: number, unitCost: number, total: number, received: number }>
  receipts: Array<{ warehouseId?: string | null, warehouseName?: string | null, inventoryMovements?: Array<{ id: string, folio: number, type: string }>, id: string, date: string, voidedAt: string | null, voidReason: string | null, items: Array<{ itemId: string, quantity: number }> }>
  invoices: PurchaseInvoiceView[]
  events: Array<{ id: string, action: string, createdBy: string, createdAt: string, detail: unknown }>
}
