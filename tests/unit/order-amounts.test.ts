import { describe, expect, it } from 'vitest'
import { orderAmounts, orderLineAmounts, orderMoney } from '../../shared/utils/orderAmounts'
import { draftLineTotal, useOrderDraft } from '../../app/composables/useOrderDraft'

describe('importes de pedidos', () => {
  it.each([
    [8, 3, 100, 277.78, 22.22, 300],
    [16, 3, 100, 258.62, 41.38, 300],
    [8, 1, 1780, 1648.15, 131.85, 1780],
    [8, 2.5, 100, 231.48, 18.52, 250],
    [8, 20, 1940, 35925.93, 2874.07, 38800],
    [16, 20, 1940, 33448.28, 5351.72, 38800]
  ])('desglosa el IVA después de multiplicar el precio pactado (IVA %s, cantidad %s)', (rate, quantity, price, subtotal, tax, total) => {
    const amounts = orderLineAmounts(quantity, price, rate, true)
    expect(amounts.subtotal.toNumber()).toBe(subtotal)
    expect(amounts.taxAmount.toNumber()).toBe(tax)
    expect(amounts.total.toNumber()).toBe(total)
  })

  it.each([0, 8, 16, [8, 16]].map(rates => ({ rates })))('conserva precio por cantidad para cualquier tasa $rates', ({ rates }) => {
    for (const price of [0.01, 0.05, 19.99, 100, 1940]) {
      for (const quantity of [1, 3, 20, 1000, 2.5, 0.125]) {
        const line = orderLineAmounts(quantity, price, rates, true)
        expect(line.total.equals(orderMoney(orderMoney(price).mul(quantity)))).toBe(true)
        expect(line.subtotal.plus(line.taxAmount).equals(line.total)).toBe(true)
      }
    }
  })

  it('conserva el total con IVA al descontar porcentajes y montos', () => {
    const percentage = orderLineAmounts(20, 1940, 8, true, 'porcentaje', 10)
    expect(percentage.total.toNumber()).toBe(34920)
    expect(percentage.subtotal.minus(percentage.discountAmount).plus(percentage.taxAmount).toNumber()).toBe(34920)
    expect(orderLineAmounts(20, 1940, 8, true, 'monto', 100).total.toNumber()).toBe(38692)
    expect(orderLineAmounts(20, 1940, 8, true, 'porcentaje', 100).total.toNumber()).toBe(0)
    expect(orderLineAmounts(20, 1940, 8, true, 'monto', 99999).total.toNumber()).toBe(0)
  })

  it('calcula el IVA adicional cuando el precio no lo incluye', () => {
    const line = orderLineAmounts(20, 1940, 8, false)
    expect(line.subtotal.toNumber()).toBe(38800)
    expect(line.taxAmount.toNumber()).toBe(3104)
    expect(line.total.toNumber()).toBe(41904)
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
    expect(line.total.toNumber()).toBe(270)
    const totals = orderAmounts([line], 'porcentaje', 7.5)
    expect(totals.discountAmount.toNumber()).toBe(20.25)
    expect(totals.total.toNumber()).toBe(249.75)
    expect(orderLineAmounts(1, 10, 8, false, 'monto', 100).total.toNumber()).toBe(0)
  })

  it('combina en un pedido productos con IVA incluido y con IVA adicional', () => {
    const draft = useOrderDraft()
    const product = {
      code: 'P1', name: 'Pintura', unit: { code: null, name: null },
      quantity: 20, unitPrice: 1940, taxPercentage: 8
    }
    draft.addProduct({ ...product, id: 'incluido', taxIncluded: true })
    draft.addProduct({ ...product, id: 'adicional', taxIncluded: false })
    const lines = draft.lines.value.map(line => orderLineAmounts(
      line.quantity, line.unitPrice, line.taxPercentage, line.taxIncluded
    ))
    expect(draftLineTotal(draft.lines.value[0]!)).toBe(38800)
    expect(draftLineTotal(draft.lines.value[1]!)).toBe(41904)
    expect(draft.total.value).toBe(80704)
    expect(orderAmounts(lines, 'porcentaje', 0).total.toNumber()).toBe(80704)
  })

  it('muestra en el editor el mismo total que calcula el servidor', () => {
    const draft = useOrderDraft()
    draft.addProduct({
      id: 'product', code: 'P1', name: 'Pintura', unit: { code: null, name: null },
      quantity: 3, unitPrice: 100, taxIncluded: true, taxPercentage: 16
    })
    expect(draft.total.value).toBe(300)
    const line = draft.lines.value[0]!
    expect(draftLineTotal(line)).toBe(orderLineAmounts(3, 100, 16, true).total.toNumber())
    draft.setDiscount('product', 'monto', 10)
    expect(draft.total.value).toBe(288.4)
  })
})
