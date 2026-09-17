import Decimal from 'decimal.js'
import { createError } from 'h3'

export function purchaseAssert(condition: unknown, message: string): asserts condition {
  if (!condition) throw createError({ statusCode: 409, statusMessage: message })
}
export const purchaseMoney = (n: Decimal.Value) => new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
export function purchaseLineTotal(quantity: number, cost: number) {
  const total = purchaseMoney(new Decimal(quantity).mul(cost))
  purchaseAssert(total.gt(0) && total.lte('9999999999999.99'), 'Importe de partida fuera de rango.')
  return total
}
export function purchaseBalance(amount: Decimal.Value, payments: Array<{ amount: { toString(): string }, voidedAt: Date | null }>) {
  return payments.filter(p => !p.voidedAt).reduce((balance, payment) => balance.minus(payment.amount.toString()), new Decimal(amount))
}
export function assertReceipt(items: Array<{ id: string, quantity: { toString(): string } }>, receipts: Array<{ voidedAt: Date | null, items: Array<{ itemId: string, quantity: { toString(): string } }> }>, incoming: Array<{ itemId: string, quantity: number }>) {
  purchaseAssert(new Set(incoming.map(i => i.itemId)).size === incoming.length, 'No repitas partidas.')
  for (const line of incoming) {
    const item = items.find(i => i.id === line.itemId)
    purchaseAssert(item, 'La partida no pertenece a esta orden.')
    const received = receipts.filter(r => !r.voidedAt).flatMap(r => r.items).filter(i => i.itemId === item.id).reduce((sum, i) => sum.plus(i.quantity.toString()), new Decimal(0))
    purchaseAssert(received.plus(line.quantity).lte(item.quantity.toString()), 'La recepción supera la cantidad pendiente.')
  }
}
