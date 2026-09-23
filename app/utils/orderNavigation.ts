const ORDER_LIST_PATHS = ['/ventas', '/igualaciones'] as const

export function orderListReturnPath(value: unknown, fallback = '/ventas') {
  if (typeof value !== 'string') return fallback

  if (value === '/pedidos-internos') return '/ventas?view=internos'
  if (value.startsWith('/pedidos-internos?')) {
    return `/ventas?view=internos&${value.slice('/pedidos-internos?'.length)}`
  }

  const isOrderListPath = ORDER_LIST_PATHS.some(path =>
    value === path || value.startsWith(`${path}?`)
  )

  return isOrderListPath ? value : fallback
}
