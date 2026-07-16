const ORDER_LIST_PATHS = ['/ventas', '/igualaciones'] as const

export function orderListReturnPath(value: unknown, fallback = '/ventas') {
  if (typeof value !== 'string') return fallback

  const isOrderListPath = ORDER_LIST_PATHS.some(path =>
    value === path || value.startsWith(`${path}?`)
  )

  return isOrderListPath ? value : fallback
}
