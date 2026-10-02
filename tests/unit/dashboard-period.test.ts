import { describe, expect, it } from 'vitest'
import { currentWeekBounds } from '../../server/utils/dashboard-period'

describe('semana en curso del inicio', () => {
  it.each([
    ['2026-09-28T18:00:00Z', '2026-09-28', '2026-10-05', '2026-09-21', 1],
    ['2026-10-02T18:00:00Z', '2026-09-28', '2026-10-05', '2026-09-21', 5],
    ['2026-10-04T18:00:00Z', '2026-09-28', '2026-10-05', '2026-09-21', 7],
    ['2027-01-01T18:00:00Z', '2026-12-28', '2027-01-04', '2026-12-21', 5],
    ['2024-02-29T18:00:00Z', '2024-02-26', '2024-03-04', '2024-02-19', 4]
  ])('calcula lunes a domingo para %s, incluso al cambiar de mes o año', (now, start, end, previousStart, elapsedDays) => {
    expect(currentWeekBounds(new Date(now))).toEqual({
      start: new Date(`${start}T00:00:00Z`),
      end: new Date(`${end}T00:00:00Z`),
      previousStart: new Date(`${previousStart}T00:00:00Z`),
      elapsedDays,
      totalDays: 7
    })
  })

  it('cambia de semana a medianoche de México, aunque UTC ya sea lunes', () => {
    const before = currentWeekBounds(new Date('2026-10-05T05:59:59Z'))
    const after = currentWeekBounds(new Date('2026-10-05T06:00:00Z'))

    expect(before.start.toISOString()).toBe('2026-09-28T00:00:00.000Z')
    expect(before.elapsedDays).toBe(7)
    expect(after.start.toISOString()).toBe('2026-10-05T00:00:00.000Z')
    expect(after.elapsedDays).toBe(1)
  })
})
