import Decimal from 'decimal.js'

export function purchaseTotals(subtotal: Decimal.Value, vatRate: number) {
  const amount = new Decimal(subtotal)
  const vatAmount = amount.mul(vatRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  return { subtotal: amount, vatAmount, total: amount.plus(vatAmount) }
}
