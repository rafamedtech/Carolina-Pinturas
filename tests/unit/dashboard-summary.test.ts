import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_ONLY_EXPENSE_CATEGORIES } from '../../app/utils/expense'

const mocks = vi.hoisted(() => ({
  role: 'admin',
  orders: vi.fn(),
  previous: vi.fn(),
  expenses: vi.fn()
}))

vi.mock('../../server/utils/auth', () => ({ requireRole: async () => ({ role: mocks.role }) }))
vi.mock('../../server/utils/prisma', () => ({
  usePrisma: () => ({
    salesOrder: { findMany: mocks.orders, aggregate: mocks.previous },
    expense: { findMany: mocks.expenses }
  })
}))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
const summary = (await import('../../server/api/dashboard/summary.get')).default
const event = {} as Parameters<typeof summary>[0]

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-02T18:00:00Z'))
  mocks.role = 'admin'
  mocks.orders.mockResolvedValue([])
  mocks.previous.mockResolvedValue({ _sum: { total: null } })
  mocks.expenses.mockResolvedValue([])
})
afterEach(() => vi.useRealTimers())

describe('resumen semanal del inicio', () => {
  it('filtra ventas y gastos por la misma semana y compara con la semana anterior', async () => {
    const result = await summary(event)
    const range = { gte: new Date('2026-09-28T00:00:00Z'), lt: new Date('2026-10-05T00:00:00Z') }

    expect(mocks.orders).toHaveBeenCalledWith(expect.objectContaining({
      where: { statusKey: { notIn: ['borrador', 'cancelado'] }, orderDate: range }
    }))
    expect(mocks.expenses).toHaveBeenCalledWith(expect.objectContaining({ where: { expenseDate: range } }))
    expect(mocks.previous).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        statusKey: { notIn: ['borrador', 'cancelado'] },
        orderDate: { gte: new Date('2026-09-21T00:00:00Z'), lt: range.gte }
      }
    }))
    expect(result.period).toEqual({
      start: '2026-09-28', end: '2026-10-04', label: '28/09/2026 – 04/10/2026', elapsedDays: 5, totalDays: 7
    })
    expect(result.dailySales.map(day => day.date)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'
    ])
    expect(result.metrics.salesChangePercentage).toBeNull()
    expect(result.metrics.projectedSales).toBe(0)
  })

  it('calcula métricas, productos, cobros y pedidos recientes con las ventas semanales', async () => {
    mocks.orders.mockResolvedValue([{
      id: 'order-1', folio: 1, orderDate: new Date('2026-10-02T00:00:00Z'), total: 500,
      customerNameSnapshot: 'Cliente', paymentStatus: 'pago_recibido', paymentMethod: 'efectivo',
      status: { key: 'entregado', label: 'Entregado', color: 'success', sortOrder: 1 },
      items: [{ productId: 'product-1', productCodeSnapshot: 'P1', productNameSnapshot: 'Pintura', quantity: 2, total: 500 }]
    }])
    mocks.previous.mockResolvedValue({ _sum: { total: 250 } })
    mocks.expenses.mockResolvedValue([{ amount: 10, exchangeRate: 20 }])

    const result = await summary(event)

    expect(result.metrics).toEqual({
      sales: 500, previousSales: 250, salesChangePercentage: 100, projectedSales: 700,
      orderCount: 1, expensesAmount: 200, averageTicket: 500, pendingAmount: 0, collectedAmount: 500
    })
    expect(result.dailySales[4]).toEqual({ date: '2026-10-02', label: '02/10/2026', total: 500, orders: 1 })
    expect(result.paymentBreakdown[0]).toMatchObject({ key: 'pago_recibido', amount: 500, percentage: 100 })
    expect(result.statusBreakdown[0]).toMatchObject({ key: 'entregado', count: 1, percentage: 100 })
    expect(result.topProducts[0]).toMatchObject({ productId: 'product-1', quantity: 2, amount: 500 })
    expect(result.recentOrders[0]).toMatchObject({ id: 'order-1', orderDate: '2026-10-02' })
  })

  it('conserva las restricciones de gastos para usuarios sin rol administrador', async () => {
    mocks.role = 'mostrador'
    await summary(event)
    expect(mocks.expenses).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ purchasePaymentId: null, category: { notIn: [...ADMIN_ONLY_EXPENSE_CATEGORIES] } })
    }))
  })
})
