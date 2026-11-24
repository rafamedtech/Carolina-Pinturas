import { expect, it } from 'vitest'
import { purchaseQuantity } from '../../app/utils/purchaseFormat'
import { purchaseActionSchema, purchaseDraftSchema } from '../../shared/schemas/purchase'

const id = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'
const draft = { providerId: id, date: '2024-02-29', currencyCode: 'MXN' }

it('formatea cantidades de compra con hasta seis decimales', () => {
  expect([0, 1234.5, 1.123456, 1.1234567].map(purchaseQuantity)).toEqual([
    '0', '1,234.5', '1.123456', '1.123457'
  ])
})

it('conserva la escala, los topes y los mensajes en partidas de compra', () => {
  const parse = (quantity: unknown, date = draft.date) => purchaseDraftSchema.safeParse({
    ...draft, date, items: [{ productId: id, quantity, unitCost: 0.000001 }]
  })
  expect(parse(0.000001).success).toBe(true)
  expect(parse(999_999_999).success).toBe(true)
  expect(parse(0).error?.issues[0]?.message).toBe('Too small: expected number to be >0')
  expect(parse(1_000_000_000).error?.issues[0]?.message).toBe('Too big: expected number to be <=999999999')
  expect(parse(1.1234567).error?.issues[0]?.message).toBe('Máximo 6 decimales.')
  expect(parse(1, '2026-02-29').error?.issues[0]?.message).toBe('Fecha inválida.')
  for (const quantity of ['1.23', Number.NaN, Infinity]) {
    expect(parse(quantity).success).toBe(false)
  }
})

it('conserva dos decimales de importe y seis de tipo de cambio en pagos', () => {
  const payment = { action: 'pay', invoiceId: id, date: draft.date, amount: 0.01, exchangeRate: 17.123456, method: 'transferencia' }
  expect(purchaseActionSchema.safeParse(payment).success).toBe(true)
  expect(purchaseActionSchema.safeParse({ ...payment, amount: 0.001 }).error?.issues[0]?.message).toBe('Máximo 2 decimales.')
  expect(purchaseActionSchema.safeParse({ ...payment, exchangeRate: 17.1234567 }).error?.issues[0]?.message).toBe('Máximo 6 decimales.')
})
