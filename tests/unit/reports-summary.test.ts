import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportDailyAverage, reportWeeks } from '../../app/utils/reportPeriods'

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
  it('separates internal customers from seller sales in every period without changing total sales', async () => {
    const order = (name: string, total: number, internal: boolean) => ({
      id: name, orderDate: new Date('2026-10-01'), total: total + total * 0.16, taxTotal: total * 0.16, discountTotal: 0,
      customerId: name, customerNameSnapshot: name, customer: { isInternalOrderCustomer: internal },
      vendedorEmail: 'seller', vendedorNombre: 'Vendedor', payments: [], items: []
    })
    mocks.orders.mockResolvedValueOnce([
      order('MOSTRADOR', 100, false), order('Cliente externo', 300, false), order('Cliente interno', 600, true)
    ]).mockResolvedValueOnce([
      order('MOSTRADOR .', 50, false), order('Cliente externo', 150, false), order('Cliente interno', 200, true)
    ])
    const result = await summary(event)
    expect(result.salesChannels).toEqual([
      { key: 'counter', label: 'Mostrador', amount: 100, count: 1, percentage: 10 },
      { key: 'seller', label: 'Vendedor', amount: 300, count: 1, percentage: 30 },
      { key: 'internal', label: 'Clientes internos', amount: 600, count: 1, percentage: 60 }
    ])
    expect(result.metrics).toMatchObject({ sales: 1000, previousCounterSales: 50, previousSellerSales: 150, previousInternalSales: 200 })
    expect(result.dailyMovements[0]).toMatchObject({ sales: 1000, counterSales: 100, sellerSales: 300, internalSales: 600 })
    expect(result.dailyMovements[1]).toMatchObject({ sales: 0, counterSales: 0, sellerSales: 0, internalSales: 0 })
    expect(result.topSellers[0]).toMatchObject({ amount: 400, count: 2, percentage: 100 })
    expect(mocks.orders).toHaveBeenNthCalledWith(1, expect.objectContaining({ select: expect.objectContaining({ customer: { select: { isInternalOrderCustomer: true } } }) }))
  })

  it('subtracts actual taxes and compares the same tax basis for both months', async () => {
    mocks.orders.mockResolvedValueOnce([{
      id: 'sale', orderDate: new Date('2026-10-01'), total: 1110, taxTotal: 160, discountTotal: 50,
      customerId: 'customer', customerNameSnapshot: 'Cliente', vendedorEmail: 'seller', vendedorNombre: 'Vendedor',
      payments: [{ amount: 100 }], items: [
        { productId: 'p1', productCodeSnapshot: 'P1', productNameSnapshot: 'Pintura', quantity: 2, total: 696, taxAmount: 96 },
        { productId: 'p2', productCodeSnapshot: 'P2', productNameSnapshot: 'Material', quantity: 1, total: 464, taxAmount: 64 }
      ], customer: { isInternalOrderCustomer: false }
    }]).mockResolvedValueOnce([{ total: 580, taxTotal: 80, customerNameSnapshot: 'Cliente', customer: { isInternalOrderCustomer: false } }])
    const result = await summary(event)
    expect(result.metrics).toMatchObject({
      salesBeforeTax: 950, salesBeforeTaxChangePercentage: 90,
      sales: 950, previousSales: 500, salesChangePercentage: 90, averageTicket: 950,
      outstandingBalance: 1010, collectionCoveragePercentage: 9, collections: 0, netCashFlow: 0
    })
    expect(result.dailyMovements[0]?.sales).toBe(950)
    expect(reportWeeks(result.dailyMovements)[0]?.sales).toBe(950)
    expect(reportDailyAverage(result.metrics.sales, result.period.elapsedDays)).toBe(475)
    expect(result.salesChannels.find(channel => channel.key === 'seller')).toMatchObject({ amount: 950, percentage: 100 })
    expect(result.topCustomers[0]).toMatchObject({ amount: 950, percentage: 100 })
    expect(result.topSellers[0]).toMatchObject({ amount: 950, percentage: 100 })
    expect(result.topProducts).toMatchObject([{ amount: 570, percentage: 60 }, { amount: 380, percentage: 40 }])
    expect(result.topDebtors[0]?.amount).toBe(1010)
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
