import { reportDailyAverage, reportWeeks, reportMonths, reportVisibleMonths } from '../../app/utils/reportPeriods'
import { describe, expect, it } from 'vitest'
import {
  reportDateOnly,
  reportTopDebtors,
  reportIsCounterSale,
  reportSalesChannel,
  reportMonthBounds,
  reportYearBounds,
  reportPercentage,
  reportPercentageChange
} from '../../server/utils/reports'

describe('report calculations', () => {
  it('builds month bounds and elapsed days for the current month', () => {
    const bounds = reportMonthBounds('2026-09', new Date('2026-09-04T12:00:00.000Z'))

    expect(reportDateOnly(bounds.start)).toBe('2026-09-01')
    expect(reportDateOnly(bounds.end)).toBe('2026-10-01')
    expect(reportDateOnly(bounds.previousStart)).toBe('2026-08-01')
    expect(bounds.elapsedDays).toBe(4)
    expect(bounds.totalDays).toBe(30)
  })

  it('uses the full month for historical reports', () => {
    expect(reportMonthBounds('2026-08', new Date('2026-09-04T12:00:00.000Z')).elapsedDays).toBe(31)
  })

  it('rejects malformed report months', () => {
    expect(() => reportMonthBounds('2026-13')).toThrow()
  })

  it('calculates shares and comparisons without dividing by zero', () => {
    expect(reportPercentage(25, 200)).toBe(12.5)
    expect(reportPercentage(25, 0)).toBe(0)
    expect(reportPercentageChange(125, 100)).toBe(25)
    expect(reportPercentageChange(100, 0)).toBeNull()
    expect(reportPercentageChange(-50, -100)).toBe(50)
  })
})

describe('business report periods', () => {
  const emptyMovement = { label: '', sales: 0, orderCount: 0, counterSales: 0, sellerSales: 0, internalSales: 0, collections: 0, expenses: 0, netCashFlow: 0, materialPurchases: 0, operatingExpenses: 0, netProfit: 0 }
  const annualDays = () => Array.from({ length: 12 }, (_, index) => ({ ...emptyMovement, date: `2026-${String(index + 1).padStart(2, '0')}-01` }))

  it('hides January through June when activity starts in July, preserving shorter empty stretches', () => {
    const days = annualDays()
    days[6]!.sales = 100
    expect(reportVisibleMonths(days).map(month => month.date)).toEqual(days.slice(6).map(day => day.date))
    expect(reportMonths(days)).toHaveLength(12)
    expect(reportVisibleMonths(days).reduce((sum, month) => sum + month.sales, 0)).toBe(100)
  })

  it('hides runs longer than six months, including trailing and entirely empty runs', () => {
    const days = annualDays()
    days[0]!.sales = 50
    expect(reportVisibleMonths(days).map(month => month.date)).toEqual(['2026-01-01'])
    expect(reportVisibleMonths(annualDays())).toEqual([])
    expect(reportVisibleMonths([])).toEqual([])
  })

  it('retains months with expenses, collections, or orders even when sales are zero', () => {
    for (const field of ['expenses', 'collections', 'orderCount', 'netProfit'] as const) {
      const days = annualDays()
      days[5]![field] = field === 'netProfit' ? -10 : 10
      // Five empty months precede June; six empty months follow it.
      expect(reportVisibleMonths(days).map(month => month.date)).toEqual(days.slice(0, 6).map(day => day.date))
    }
  })

  it('builds calendar years, including leap days, and excludes future days', () => {
    const now = new Date('2026-03-01T12:00:00Z')
    const current = reportYearBounds('2026', now)
    expect(current).toMatchObject({ start: new Date('2026-01-01'), end: new Date('2027-01-01'), previousStart: new Date('2025-01-01'), totalDays: 365, elapsedDays: 60 })
    expect(reportYearBounds('2024', now)).toMatchObject({ totalDays: 366, elapsedDays: 366 })
    expect(reportYearBounds('2027', now).elapsedDays).toBe(0)
    expect(reportYearBounds(undefined, now)).toEqual(current)
    for (const year of ['', '26', '2026-01', '0000', '9999']) expect(() => reportYearBounds(year, now)).toThrow()
  })

  it('groups annual movements by month, preserving expenses and months without activity', () => {
    const empty = { label: '', sales: 0, orderCount: 0, counterSales: 0, sellerSales: 0, internalSales: 0, collections: 0, expenses: 0, netCashFlow: 0, materialPurchases: 0, operatingExpenses: 0, netProfit: 0 }
    const months = reportMonths([
      { ...empty, date: '2026-01-01', sales: 100, orderCount: 1, collections: 50, netCashFlow: 50, netProfit: 100 },
      { ...empty, date: '2026-01-02', materialPurchases: 20, operatingExpenses: 10, expenses: 30, netProfit: -30, netCashFlow: -30 },
      { ...empty, date: '2026-02-01' }
    ])
    expect(months).toHaveLength(2)
    expect(months[0]).toMatchObject({ start: '2026-01-01', end: '2026-01-02', days: 2, sales: 100, orderCount: 1, expenses: 30, materialPurchases: 20, operatingExpenses: 10, netProfit: 70, netCashFlow: 20 })
    expect(months[1]).toMatchObject({ start: '2026-02-01', days: 1, sales: 0 })
    expect(reportMonths([])).toEqual([])
  })

  it('does not include future days', () => {
    expect(reportMonthBounds('2026-10', new Date('2026-09-07T12:00:00Z')).elapsedDays).toBe(0)
  })

  it('classifies by the counter customer, not the employee who recorded the sale', () => {
    expect(reportIsCounterSale('MOSTRADOR .')).toBe(true)
    expect(reportIsCounterSale('mostrador')).toBe(true)
    expect(reportIsCounterSale('Taller Mostrador Norte')).toBe(false)
  })

  it('classifies internal customers by their flag before checking the counter name', () => {
    expect(reportSalesChannel({ customerNameSnapshot: 'MOSTRADOR', customer: { isInternalOrderCustomer: true } })).toBe('internal')
    expect(reportSalesChannel({ customerNameSnapshot: 'MOSTRADOR', customer: { isInternalOrderCustomer: false } })).toBe('counter')
    expect(reportSalesChannel({ customerNameSnapshot: 'Cliente', customer: { isInternalOrderCustomer: false } })).toBe('seller')
  })

  it('groups Monday–Sunday weeks and preserves zero-activity and partial days', () => {
    const days = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-09-0${index + 1}`, label: '', sales: index === 0 ? 100 : 0,
      orderCount: index === 0 ? 2 : 0, counterSales: index === 0 ? 25 : 0,
      sellerSales: index === 0 ? 75 : 0, internalSales: index === 6 ? 50 : 0, collections: 0, expenses: index === 6 ? 20 : 0, netCashFlow: 0
    }))
    const weeks = reportWeeks(days)
    expect(weeks).toHaveLength(2)
    expect(weeks[0]).toMatchObject({ start: '2026-09-01', end: '2026-09-06', days: 6, sales: 100, orderCount: 2, counterSales: 25, sellerSales: 75 })
    expect(weeks[0]?.internalSales).toBe(0)
    expect(weeks[1]).toMatchObject({ start: '2026-09-07', end: '2026-09-07', days: 1, sales: 0, internalSales: 50, expenses: 20 })
    expect(reportWeeks([])).toEqual([])
  })

  it('averages over elapsed calendar days without dividing by zero', () => {
    expect(reportDailyAverage(700, 7)).toBe(100)
    expect(reportDailyAverage(0, 0)).toBe(0)
  })
})

describe('customers with outstanding balances', () => {
  it('groups unpaid balances per customer and does not offset debts with overpaid orders', () => {
    const orders = [
      { customerId: 'a', customerNameSnapshot: 'Cliente A', total: 100, payments: [{ amount: 40 }] },
      { customerId: 'a', customerNameSnapshot: 'Cliente A', total: 50, payments: [] },
      { customerId: 'a', customerNameSnapshot: 'Cliente A', total: 20, payments: [{ amount: 40 }] },
      { customerId: 'b', customerNameSnapshot: 'Cliente B', total: 200, payments: [{ amount: 50 }, { amount: 40 }] },
      { customerId: 'c', customerNameSnapshot: 'Cliente C', total: 30, payments: [{ amount: 30 }] }
    ]
    expect(reportTopDebtors(orders)).toEqual([
      { id: 'a', label: 'Cliente A', detail: 'Saldo pendiente', amount: 110, count: 2, percentage: 50 },
      { id: 'b', label: 'Cliente B', detail: 'Saldo pendiente', amount: 110, count: 1, percentage: 50 }
    ])
  })

  it('returns the five largest balances with percentages based on all debtors', () => {
    const orders = Array.from({ length: 6 }, (_, i) => ({
      customerId: String(i), customerNameSnapshot: `Cliente ${i}`, total: (i + 1) * 100, payments: []
    }))
    const result = reportTopDebtors(orders)
    expect(result.map(item => item.amount)).toEqual([600, 500, 400, 300, 200])
    expect(result[0]?.percentage).toBe(28.6)
    expect(reportTopDebtors([])).toEqual([])
  })
})
