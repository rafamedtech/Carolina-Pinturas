import { reportDailyAverage, reportWeeks } from '../../app/utils/reportPeriods'
import { describe, expect, it } from 'vitest'
import {
  reportDateOnly,
  reportTopDebtors,
  reportIsCounterSale,
  reportMonthBounds,
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
  it('does not include future days', () => {
    expect(reportMonthBounds('2026-10', new Date('2026-09-07T12:00:00Z')).elapsedDays).toBe(0)
  })

  it('classifies by the counter customer, not the employee who recorded the sale', () => {
    expect(reportIsCounterSale('MOSTRADOR .')).toBe(true)
    expect(reportIsCounterSale('mostrador')).toBe(true)
    expect(reportIsCounterSale('Taller Mostrador Norte')).toBe(false)
  })

  it('groups Monday–Sunday weeks and preserves zero-activity and partial days', () => {
    const days = Array.from({ length: 7 }, (_, index) => ({
      date: `2026-09-0${index + 1}`, label: '', sales: index === 0 ? 100 : 0,
      orderCount: index === 0 ? 2 : 0, counterSales: index === 0 ? 25 : 0,
      sellerSales: index === 0 ? 75 : 0, collections: 0, expenses: index === 6 ? 20 : 0, netCashFlow: 0
    }))
    const weeks = reportWeeks(days)
    expect(weeks).toHaveLength(2)
    expect(weeks[0]).toMatchObject({ start: '2026-09-01', end: '2026-09-06', days: 6, sales: 100, orderCount: 2, counterSales: 25, sellerSales: 75 })
    expect(weeks[1]).toMatchObject({ start: '2026-09-07', end: '2026-09-07', days: 1, sales: 0, expenses: 20 })
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
