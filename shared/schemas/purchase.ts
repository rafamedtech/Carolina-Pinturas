import * as z from 'zod'

export const purchaseDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}, 'Fecha inválida.')
const decimal = (precision: number) => z.number().positive().max(999_999_999).refine(n => Number(n.toFixed(precision)) === n, `Máximo ${precision} decimales.`)
export const purchaseDraftSchema = z.object({
  providerId: z.uuid(), date: purchaseDate, currencyCode: z.enum(['MXN', 'USD']),
  notes: z.string().trim().max(2000).default(''),
  items: z.array(z.object({ productId: z.uuid(), quantity: decimal(6), unitCost: decimal(6) })).min(1).max(100)
}).refine(v => new Set(v.items.map(i => i.productId)).size === v.items.length, 'No repitas productos.')
const invoiceFields = { folio: z.string().trim().min(1).max(100), date: purchaseDate, dueDate: purchaseDate, amount: decimal(2) }
const reason = z.string().trim().min(3).max(1000)
export const purchaseActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit'), draft: purchaseDraftSchema }),
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('cancel'), reason }),
  z.object({ action: z.literal('receive'), warehouseId: z.uuid().optional(), date: purchaseDate, items: z.array(z.object({ itemId: z.uuid(), quantity: decimal(6) })).min(1).max(100) }),
  z.object({ action: z.literal('voidReceipt'), id: z.uuid(), reason }),
  z.object({ action: z.literal('invoice'), ...invoiceFields }),
  z.object({ action: z.literal('editInvoice'), id: z.uuid(), ...invoiceFields }),
  z.object({ action: z.literal('voidInvoice'), id: z.uuid(), reason }),
  z.object({ action: z.literal('pay'), invoiceId: z.uuid(), date: purchaseDate, amount: decimal(2), exchangeRate: decimal(6), method: z.enum(['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro']) }),
  z.object({ action: z.literal('voidPayment'), id: z.uuid(), reason })
])
export const purchaseCommandSchema = z.object({ requestId: z.uuid(), version: z.number().int().positive(), command: purchaseActionSchema })
export const purchaseCreateSchema = z.object({ requestId: z.uuid(), draft: purchaseDraftSchema })
export type PurchaseDraft = z.infer<typeof purchaseDraftSchema>
export type PurchaseAction = z.infer<typeof purchaseActionSchema>
export type PurchaseCommand = z.infer<typeof purchaseCommandSchema>
