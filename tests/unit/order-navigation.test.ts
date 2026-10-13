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

  it('migrates the former internal-orders page to the orders tab', () => {
    const returnTo = '/pedidos-internos?search=Cliente&page=2'

    expect(orderListReturnPath(returnTo)).toBe('/ventas?view=internos&search=Cliente&page=2')
    expect(orderListReturnPath('/pedidos-internos')).toBe('/ventas?view=internos')
  })

  it('rejects external and unrelated return paths', () => {
    expect(orderListReturnPath('https://example.com')).toBe('/ventas')
    expect(orderListReturnPath('/configuracion')).toBe('/ventas')
    expect(orderListReturnPath(['/ventas'])).toBe('/ventas')
  })

  it('uses the role-specific fallback when the route has no return path', () => {
    expect(orderListReturnPath(undefined, '/igualaciones')).toBe('/igualaciones')
  })

  it('returns to related lists and details with their filters intact', () => {
    for (const path of ['/pagos?search=Mostrador&page=2', '/inventario?tab=reservations', '/clientes/customer-1?orders_page=3', '/repartidores/driver-1?returnTo=%2Frepartidores%3Fsearch%3DAlex']) {
      expect(orderListReturnPath(path)).toBe(path)
    }
  })
})
