import Decimal from 'decimal.js'

// Siigo México recibe precio unitario y pagos con dos decimales. Redondear
// la base unitaria antes de multiplicar evita cobrar un total que la factura
// no puede representar. Las cantidades internas conservan su precisión.
export function orderMoney(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

export function orderDiscount(base: Decimal.Value, type: string, value: Decimal.Value) {
  const amount = new Decimal(base)
  const discount = Decimal.max(0, orderMoney(value))
  return orderMoney(type === 'monto'
    ? Decimal.min(discount, amount)
    : amount.mul(Decimal.min(discount, 100)).div(100))
}

export function orderLineAmounts(
  quantity: Decimal.Value,
  unitPrice: Decimal.Value,
  taxPercentage: Decimal.Value | readonly Decimal.Value[],
  taxIncluded: boolean,
  discountType = 'porcentaje',
  discountValue: Decimal.Value = 0
) {
  const rates = Array.isArray(taxPercentage) ? taxPercentage : [taxPercentage as Decimal.Value]
  const rate = rates.reduce<Decimal>((sum, value) => sum.plus(value), new Decimal(0))
  const listedPrice = orderMoney(unitPrice)
  const price = taxIncluded && rate.gt(0)
    ? orderMoney(listedPrice.div(rate.div(100).plus(1)))
    : listedPrice
  const subtotal = orderMoney(price.mul(quantity))
  const discountAmount = orderDiscount(subtotal, discountType, discountValue)
  const taxableBase = subtotal.minus(discountAmount)
  const taxAmount = rates.reduce<Decimal>(
    (sum, value) => sum.plus(orderMoney(taxableBase.mul(value).div(100))), new Decimal(0)
  )
  return { price, subtotal, discountAmount, taxAmount, total: orderMoney(taxableBase.plus(taxAmount)) }
}

export function orderAmounts(
  lines: readonly { subtotal: Decimal.Value, discountAmount: Decimal.Value, taxAmount: Decimal.Value, total: Decimal.Value }[],
  discountType: string,
  discountValue: Decimal.Value
) {
  const sum = (key: 'subtotal' | 'discountAmount' | 'taxAmount' | 'total') =>
    lines.reduce((total, line) => total.plus(orderMoney(line[key])), new Decimal(0))
  const discountAmount = orderDiscount(sum('total'), discountType, discountValue)
  return {
    subtotal: sum('subtotal'),
    taxTotal: sum('taxAmount'),
    discountAmount,
    discountTotal: sum('discountAmount').plus(discountAmount),
    total: sum('total').minus(discountAmount)
  }
}
