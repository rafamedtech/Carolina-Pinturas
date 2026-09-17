import { describe, expect, it } from 'vitest'
import Decimal from 'decimal.js'
import { purchaseCommandSchema, purchaseDraftSchema } from '../../shared/schemas/purchase'
import { purchaseBalance, purchaseLineTotal, assertReceipt } from '../../server/utils/purchase-domain'
import { canAccessAppPath } from '../../app/utils/roleAccess'

const id = '00000000-0000-4000-8000-000000000001'
describe('reglas de compras', () => {
  it('redondea cada partida con decimales exactos', () => {
    expect(purchaseLineTotal(3, 0.335).toString()).toBe('1.01')
    expect(purchaseLineTotal(0.1, 10.05).toString()).toBe('1.01')
    expect(() => purchaseLineTotal(0.000001, 0.000001)).toThrow()
  })
  it('valida fecha, moneda, cantidades y costos sin precios de venta', () => {
    const draft = { providerId: id, date: '2026-09-16', currencyCode: 'USD', items: [{ productId: id, quantity: 1.123456, unitCost: 2.123456 }] }
    expect(purchaseDraftSchema.safeParse(draft).success).toBe(true)
    expect(purchaseDraftSchema.safeParse({ ...draft, date: '2026-02-30' }).success).toBe(false)
    expect(purchaseDraftSchema.safeParse({ ...draft, items: [...draft.items, ...draft.items] }).success).toBe(false)
    expect(purchaseDraftSchema.safeParse({ ...draft, items: [{ productId: id, quantity: 1, unitCost: 1.1234567 }] }).success).toBe(false)
    expect(purchaseCommandSchema.safeParse({ requestId: id, version: 1, command: { action: 'pay', invoiceId: id, date: '2026-09-16', amount: -2, exchangeRate: 1, method: 'efectivo' } }).success).toBe(false)
  })
  it('resta solo pagos vigentes', () => {
    expect(purchaseBalance('100.01', [{ amount: new Decimal('30.01'), voidedAt: null }, { amount: new Decimal(50), voidedAt: new Date() }]).toString()).toBe('70')
  })
  it('recibe parcial/completa, revierte anulaciones y rechaza excesos o partidas ajenas', () => {
    const items = [{ id, quantity: new Decimal(10) }]
    const receipts = [{ voidedAt: null, items: [{ itemId: id, quantity: new Decimal(4) }] }]
    expect(() => assertReceipt(items, receipts, [{ itemId: id, quantity: 6 }])).not.toThrow()
    expect(() => assertReceipt(items, receipts, [{ itemId: id, quantity: 7 }])).toThrow()
    expect(() => assertReceipt(items, receipts, [{ itemId: 'other', quantity: 1 }])).toThrow()
    expect(() => assertReceipt(items, receipts, [{ itemId: id, quantity: 1 }, { itemId: id, quantity: 1 }])).toThrow()
    expect(() => assertReceipt(items, [{ ...receipts[0]!, voidedAt: new Date() }], [{ itemId: id, quantity: 10 }])).not.toThrow()
  })
  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'] as const)('bloquea navegación para %s', (role) => {
    expect(canAccessAppPath(role, '/compras')).toBe(false)
    expect(canAccessAppPath(role, '/compras/cuentas-por-pagar')).toBe(false)
    expect(canAccessAppPath('admin', '/compras/nueva')).toBe(true)
  })
})
