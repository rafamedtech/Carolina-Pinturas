import { describe, expect, it } from 'vitest'
import { dashboardCompactCurrency } from '../../app/utils/dashboardFormatters'

describe('dashboardCompactCurrency', () => {
  it.each([
    [4_800, '$4.8 k'],
    [1_250_000, '$1.3 M'],
    [-7_200, '-$7.2 k']
  ])('formats %i deterministically as %s', (value, expected) => {
    expect(dashboardCompactCurrency(value)).toBe(expected)
  })
})
