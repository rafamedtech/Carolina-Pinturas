const ORDER_LIST_PATHS = ['/ventas', '/igualaciones', '/pagos', '/inventario'] as const

export function orderListReturnPath(value: unknown, fallback = '/ventas') {
  if (typeof value !== 'string' || value.includes('\\')) return fallback

  if (value === '/pedidos-internos') return '/ventas?view=internos'
  if (value.startsWith('/pedidos-internos?')) {
    return `/ventas?view=internos&${value.slice('/pedidos-internos?'.length)}`
  }

  const isOrderListPath = ORDER_LIST_PATHS.some(path =>
    value === path || value.startsWith(`${path}?`)
  )

  const isRelatedDetail = /^\/(clientes|proveedores|repartidores)\/[^/?#]+(?:\?[^#]*)?$/.test(value)
  return isOrderListPath || isRelatedDetail ? value : fallback
}
