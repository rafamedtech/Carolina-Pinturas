import { describe, expect, it } from 'vitest'
import {
  reportDateOnly,
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
