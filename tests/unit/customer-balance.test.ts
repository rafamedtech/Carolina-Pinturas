import { describe, expect, it } from 'vitest'
import { customerBalanceSummary } from '../../server/utils/customer-balance'

const today = '2026-10-25'
const order = (date: string, payments: number[] = [], total = 100, statusKey = 'ingresado') => ({
  orderDate: new Date(`${date}T00:00:00.000Z`),
  total,
  statusKey,
  payments: payments.map(amount => ({ amount }))
})
const summary = (orders: ReturnType<typeof order>[]) => customerBalanceSummary('customer', orders, today)

describe('saldo del cliente para venta a domicilio', () => {
  it('está al corriente sin pedidos o con todos los pedidos pagados', () => {
    expect(summary([]).status).toBe('current')
    expect(summary([order('2026-10-01', [40, 60])])).toMatchObject({ status: 'current', balance: 0, pendingOrders: 0 })
  })

  it('muestra hasta dos pedidos recientes sin abonos en amarillo', () => {
    expect(summary([order('2026-10-25'), order('2026-10-18')])).toMatchObject({
      status: 'recent', balance: 200, pendingOrders: 2, recentUnpaidOrders: 2, overdueOrders: 0
    })
  })

  it('marca vencido cualquier pedido de más de siete días incluso con abonos', () => {
    expect(summary([order('2026-10-17', [70]), order('2026-10-25')])).toMatchObject({
      status: 'overdue', balance: 130, pendingOrders: 2, overdueOrders: 1
    })
  })

  it('excluye cotizaciones, cancelados y pedidos pagados de la deuda y su antigüedad', () => {
    expect(summary([
      order('2026-10-01', [], 100, 'borrador'),
      order('2026-10-01', [], 100, 'cancelado'),
      order('2026-10-01', [100]),
      order('2026-10-25', [25])
    ])).toMatchObject({ status: 'recent', balance: 75, pendingOrders: 1, overdueOrders: 0, recentUnpaidOrders: 0 })
  })

  it('conserva los centavos y no compensa deuda de un pedido con sobrepagos de otro', () => {
    expect(summary([order('2026-10-25', [0.1], 0.3), order('2026-10-25', [120])])).toMatchObject({
      balance: 0.2, pendingOrders: 1
    })
  })
})
