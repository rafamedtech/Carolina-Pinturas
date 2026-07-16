import { describe, expect, it } from 'vitest'
import { orderListReturnPath } from '../../app/utils/orderNavigation'

describe('orderListReturnPath', () => {
  it('keeps the orders list filters in the return path', () => {
    const returnTo = '/ventas?search=Cliente&status=confirmado&page=2'

    expect(orderListReturnPath(returnTo)).toBe(returnTo)
  })

  it('supports returning to the matching list', () => {
    const returnTo = '/igualaciones?status=en_espera'

    expect(orderListReturnPath(returnTo)).toBe(returnTo)
  })

  it('rejects external and unrelated return paths', () => {
    expect(orderListReturnPath('https://example.com')).toBe('/ventas')
    expect(orderListReturnPath('/configuracion')).toBe('/ventas')
    expect(orderListReturnPath(['/ventas'])).toBe('/ventas')
  })

  it('uses the role-specific fallback when the route has no return path', () => {
    expect(orderListReturnPath(undefined, '/igualaciones')).toBe('/igualaciones')
  })
})
