import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  orders: vi.fn(), expenses: vi.fn(), invoices: vi.fn(), payments: vi.fn(), previousPayments: vi.fn()
}))
vi.mock('../../server/utils/auth', () => ({ requireRole: vi.fn() }))
vi.mock('../../server/utils/prisma', () => ({
  usePrisma: () => ({
    salesOrder: { findMany: mocks.orders },
    expense: { findMany: mocks.expenses },
    purchaseInvoice: { findMany: mocks.invoices },
    salesOrderPayment: { findMany: mocks.payments, aggregate: mocks.previousPayments }
  })
}))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('getQuery', () => ({ month: '2026-10' }))
const summary = (await import('../../server/api/reports/summary.get')).default
const event = {} as Parameters<typeof summary>[0]

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-02T18:00:00Z'))
  mocks.orders.mockResolvedValue([])
  mocks.expenses.mockResolvedValue([])
  mocks.invoices.mockResolvedValue([])
  mocks.payments.mockResolvedValue([])
  mocks.previousPayments.mockResolvedValue({ _sum: { amount: null } })
})
afterEach(() => vi.useRealTimers())

describe('report summary cards', () => {
  it('subtracts actual taxes and compares the same tax basis for both months', async () => {
    mocks.orders.mockResolvedValueOnce([{
      id: 'sale', orderDate: new Date('2026-10-01'), total: 1110, taxTotal: 160, discountTotal: 50,
      customerId: 'customer', customerNameSnapshot: 'Cliente', vendedorEmail: 'seller', vendedorNombre: 'Vendedor',
      payments: [{ amount: 100 }], items: []
    }]).mockResolvedValueOnce([{ total: 580, taxTotal: 80, customerNameSnapshot: 'Cliente' }])
    const result = await summary(event)
    expect(result.metrics).toMatchObject({
      salesBeforeTax: 950, salesBeforeTaxChangePercentage: 90,
      sales: 1110, outstandingBalance: 1010, collections: 0
    })
  })

  it('excludes material purchases from the card while preserving cash outflows', async () => {
    const expense = { id: 'e', expenseDate: new Date('2026-10-01'), description: '', providerNameSnapshot: '', paymentMethod: 'efectivo', currencyCode: 'MXN', notes: null }
    mocks.expenses.mockResolvedValueOnce([
      { ...expense, category: 'Otros', amount: 10, exchangeRate: 20, purchasePaymentId: null },
      { ...expense, category: 'Compra de materiales', amount: 100, exchangeRate: 1, purchasePaymentId: null },
      { ...expense, category: 'Otros', amount: 50, exchangeRate: 1, purchasePaymentId: 'payment' }
    ]).mockResolvedValueOnce([
      { category: 'Otros', amount: 100, exchangeRate: 1, purchasePaymentId: null },
      { category: 'Compra de materiales', amount: 500, exchangeRate: 1, purchasePaymentId: null }
    ])
    const result = await summary(event)
    expect(result.metrics).toMatchObject({
      operatingExpenses: 200, operatingExpensesChangePercentage: 100, expenses: 350, netCashFlow: -350
    })
  })

  it('totals invoices by currency and invoice month, excluding voided invoices in the query', async () => {
    mocks.invoices.mockResolvedValue([
      { date: new Date('2026-10-01'), amount: 100, order: { currencyCode: 'MXN' } },
      { date: new Date('2026-10-02'), amount: 200, order: { currencyCode: 'MXN' } },
      { date: new Date('2026-09-01'), amount: 150, order: { currencyCode: 'MXN' } },
      { date: new Date('2026-10-01'), amount: 50, order: { currencyCode: 'USD' } }
    ])
    const result = await summary(event)
    expect(mocks.invoices).toHaveBeenCalledWith(expect.objectContaining({ where: {
      voidedAt: null, order: { status: { notIn: ['borrador', 'cancelada'] } },
      date: { gte: new Date('2026-09-01'), lt: new Date('2026-10-03') }
    } }))
    expect(result.metrics.purchaseInvoiceTotals).toEqual([
      { currencyCode: 'MXN', amount: 300, previousAmount: 150, changePercentage: 100 },
      { currencyCode: 'USD', amount: 50, previousAmount: 0, changePercentage: null }
    ])
  })

  it('returns zero totals and no comparison for months without activity', async () => {
    const result = await summary(event)
    expect(result.metrics).toMatchObject({ salesBeforeTax: 0, operatingExpenses: 0, salesBeforeTaxChangePercentage: null, operatingExpensesChangePercentage: null })
    expect(result.metrics.purchaseInvoiceTotals.every(total => total.amount === 0 && total.changePercentage === null)).toBe(true)
  })
})
