import { describe, expect, it } from 'vitest'
import { inventoryForRole, purchaseViewForRole } from '../../server/utils/purchase-visibility'
import type { PurchaseView } from '../../app/types/purchases'

const view: PurchaseView = {
  id: 'order-1',
  folio: 7,
  status: 'vencida',
  version: 3,
  providerId: 'provider-1',
  providerName: 'Proveedor',
  providerRfc: null,
  date: '2026-11-01',
  currencyCode: 'MXN',
  subtotal: 100,
  vatRate: 16,
  vatAmount: 16,
  total: 116,
  balance: 50,
  invoiced: 116,
  notes: '',
  receiptStatus: 'parcial',
  items: [{ id: 'item-1', productId: 'p-1', code: 'A1', name: 'Pintura', quantity: 10, unitCost: 10, total: 100, received: 4 }],
  receipts: [{ id: 'r-1', date: '2026-11-02', voidedAt: null, voidReason: null, items: [{ itemId: 'item-1', quantity: 4 }] }],
  invoices: [{ id: 'i-1', folio: 'F1', date: '2026-11-03', dueDate: '2026-11-10', amount: 116, balance: 50, status: 'vencida', voidedAt: null, voidReason: null, payments: [] }],
  events: [
    { id: 'e-1', action: 'create', createdBy: 'admin@example.com', createdAt: '2026-11-01T10:00:00Z', detail: { items: [{ unitCost: 10 }] } },
    { id: 'e-2', action: 'receive', createdBy: 'mostrador@example.com', createdAt: '2026-11-02T10:00:00Z', detail: { items: [] } },
    { id: 'e-3', action: 'pay', createdBy: 'admin@example.com', createdAt: '2026-11-04T10:00:00Z', detail: { amount: 66 } },
    { id: 'e-4', action: 'cancel', createdBy: 'admin@example.com', createdAt: '2026-11-05T10:00:00Z', detail: { reason: 'Duplicada' } }
  ]
}

describe('visibilidad de compras por rol', () => {
  it.each(['admin', 'consulta'] as const)('%s conserva importes, facturas y eventos', (role) => {
    expect(purchaseViewForRole(view, role)).toBe(view)
  })

  it('mostrador conserva cantidades y recepciones sin costos, facturas ni abonos', () => {
    const result = purchaseViewForRole(view, 'mostrador')
    expect(result.financialsHidden).toBe(true)
    expect(result.status).toBe('confirmada')
    expect([result.subtotal, result.vatAmount, result.total, result.balance, result.invoiced]).toEqual([0, 0, 0, 0, 0])
    expect(result.items).toEqual([{ ...view.items[0], unitCost: 0, total: 0 }])
    expect(result.receipts).toEqual(view.receipts)
    expect(result.invoices).toEqual([])
    expect(result.events.map(event => event.action)).toEqual(['create', 'receive', 'cancel'])
    expect(result.events.map(event => event.detail)).toEqual([null, null, { reason: 'Duplicada' }])
  })
})

describe('costos de inventario por rol', () => {
  const page = {
    results: [{ productId: 'p-1', quantity: '4', unitCost: '12.50', costCurrency: 'MXN', initialUnitCost: '10', initialCostCurrency: 'MXN', lines: [{ unitCost: '9', counted: '1' }] }],
    pagination: { page: 1 }
  }

  it.each(['admin', 'consulta'] as const)('%s conserva los costos', (role) => {
    expect(inventoryForRole(page, role)).toBe(page)
  })

  it.each(['mostrador', 'vendedor'] as const)('%s recibe existencias sin costos, también anidados', (role) => {
    expect(inventoryForRole(page, role)).toEqual({
      results: [{ productId: 'p-1', quantity: '4', lines: [{ counted: '1' }] }],
      pagination: { page: 1 }
    })
  })
})
