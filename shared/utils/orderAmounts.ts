import Decimal from 'decimal.js'

// Importes monetarios en centavos con redondeo decimal, sin errores binarios.
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
  // El precio con IVA es el importe pactado: multiplicarlo antes de extraer
  // la base evita que el redondeo unitario cambie lo que se cobra al cliente.
  const listedTotal = orderMoney(listedPrice.mul(quantity))
  const factor = rate.div(100).plus(1)
  const subtotal = taxIncluded && rate.gt(0)
    ? orderMoney(listedTotal.div(factor))
    : listedTotal
  const discountAmount = orderDiscount(subtotal, discountType, discountValue)
  const taxableBase = subtotal.minus(discountAmount)
  if (taxIncluded && rate.gt(0)) {
    const grossDiscount = discountType === 'monto'
      ? Decimal.min(listedTotal, orderMoney(discountAmount.mul(factor)))
      : orderDiscount(listedTotal, discountType, discountValue)
    const total = listedTotal.minus(grossDiscount)
    // El IVA absorbe el centavo residual del desglose, nunca el total pactado.
    const taxAmount = total.minus(taxableBase)
    return { price, subtotal, discountAmount, taxAmount, total }
  }
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
