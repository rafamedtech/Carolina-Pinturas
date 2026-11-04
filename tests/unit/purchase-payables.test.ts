import { describe, expect, it } from 'vitest'
import type { PurchaseView } from '../../app/types/purchases'
import { inPayablePeriod, payableRows, payablePeriodEnd, payableBalance } from '../../app/utils/purchasePayables'

function order(dueDate: string, balance = 100, overrides: Partial<PurchaseView> = {}): PurchaseView {
  return {
    id: 'order', folio: 10, status: 'confirmada', providerId: 'provider', providerName: 'Proveedor', currencyCode: 'MXN',
    invoices: [{ id: dueDate, folio: 'F-1', date: '2026-10-01', dueDate, amount: 100, balance, status: 'pendiente', voidedAt: null, voidReason: null, payments: [] }],
    ...overrides
  } as PurchaseView
}

describe('planeación de cuentas por pagar', () => {
  const today = '2026-11-04'
  it('cierra la semana el domingo y respeta los límites del mes y año', () => {
    expect(payablePeriodEnd(today, 'week')).toBe('2026-11-08')
    expect(payablePeriodEnd('2026-11-08', 'week')).toBe('2026-11-08')
    expect(payablePeriodEnd('2026-12-31', 'week')).toBe('2027-01-03')
    expect(payablePeriodEnd('2028-02-10', 'month')).toBe('2028-02-29')
    expect(payablePeriodEnd('2026-12-31', 'month')).toBe('2026-12-31')
  })
  it('separa vencidas, hoy, semana y mes sin incluir facturas liquidadas', () => {
    const rows = payableRows(['2026-11-03', today, '2026-11-08', '2026-11-09', '2026-11-30', '2026-12-01'].map(date => order(date)).concat(order(today, 0)), today)
    expect(rows.filter(row => inPayablePeriod(row, 'overdue', today)).map(row => row.dueDate)).toEqual(['2026-11-03'])
    expect(rows.filter(row => inPayablePeriod(row, 'week', today)).map(row => row.dueDate)).toEqual([today, '2026-11-08'])
    expect(rows.filter(row => inPayablePeriod(row, 'month', today))).toHaveLength(4)
    expect(rows[0]?.daysUntilDue).toBe(-1)
    expect(rows[0]?.status).toBe('vencida')
  })
  it('excluye canceladas y anuladas; recalcula estados al cambiar el día', () => {
    const active = order(today)
    const voided = order(today)
    voided.invoices[0]!.voidedAt = today
    expect(payableRows([active, voided, order(today, 100, { status: 'cancelada' })], '2026-11-05')).toHaveLength(1)
    expect(payableRows([active], '2026-11-05')[0]?.status).toBe('vencida')
  })
  it('suma saldos con precisión decimal', () => {
    expect(payableBalance([{ balance: 0.1 }, { balance: 0.2 }])).toBe(0.3)
  })
})
