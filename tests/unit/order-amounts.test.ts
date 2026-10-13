import { describe, expect, it } from 'vitest'
import { orderAmounts, orderLineAmounts, orderMoney } from '../../shared/utils/orderAmounts'
import { draftLineTotal, useOrderDraft } from '../../app/composables/useOrderDraft'

describe('importes de pedidos compatibles con Siigo México', () => {
  it.each([
    [8, 3, 100, 277.77, 22.22, 299.99],
    [16, 3, 100, 258.63, 41.38, 300.01],
    [8, 1, 1780, 1648.15, 131.85, 1780],
    [8, 2.5, 100, 231.48, 18.52, 250]
  ])('redondea la base unitaria antes de multiplicar (IVA %s, cantidad %s)', (rate, quantity, price, subtotal, tax, total) => {
    const amounts = orderLineAmounts(quantity, price, rate, true)
    expect(amounts.subtotal.toNumber()).toBe(subtotal)
    expect(amounts.taxAmount.toNumber()).toBe(tax)
    expect(amounts.total.toNumber()).toBe(total)
  })

  it('redondea cada impuesto por partida y suma centavos', () => {
    const line = orderLineAmounts(1, 0.05, [8, 16], false)
    expect(line.taxAmount.toNumber()).toBe(0.01)
    expect(orderAmounts([line, line, line], 'porcentaje', 0).total.toNumber()).toBe(0.18)
  })

  it('usa redondeo decimal half-up sin errores binarios', () => {
    expect(orderMoney(1.005).toNumber()).toBe(1.01)
    expect(orderMoney(2.675).toNumber()).toBe(2.68)
    const line = orderLineAmounts(1, 1.005, 0, false)
    expect(line.total.toNumber()).toBe(1.01)
  })

  it('aplica descuentos e impuestos en centavos y limita el descuento a la base', () => {
    const line = orderLineAmounts(3, 100, 8, true, 'porcentaje', 10)
    expect(line.discountAmount.toNumber()).toBe(27.78)
    expect(line.taxAmount.toNumber()).toBe(20)
    expect(line.total.toNumber()).toBe(269.99)
    const totals = orderAmounts([line], 'porcentaje', 7.5)
    expect(totals.discountAmount.toNumber()).toBe(20.25)
    expect(totals.total.toNumber()).toBe(249.74)
    expect(orderLineAmounts(1, 10, 8, false, 'monto', 100).total.toNumber()).toBe(0)
  })

  it('muestra en el editor el mismo total que calcula el servidor', () => {
    const draft = useOrderDraft()
    draft.addProduct({
      id: 'product', code: 'P1', name: 'Pintura', unit: { code: null, name: null },
      quantity: 3, unitPrice: 100, taxIncluded: true, taxPercentage: 16
    })
    expect(draft.total.value).toBe(300.01)
    const line = draft.lines.value[0]!
    expect(draftLineTotal(line)).toBe(orderLineAmounts(3, 100, 16, true).total.toNumber())
    draft.setDiscount('product', 'monto', 10)
    expect(draft.total.value).toBe(288.41)
  })
})
