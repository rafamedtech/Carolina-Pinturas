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

export const orderListTabs = [
  { label: 'Todos', value: 'all', icon: 'i-lucide-list' },
  { label: 'Cotización', value: 'cotizacion', icon: 'i-lucide-file-text' },
  { label: 'Mostrador', value: 'mostrador', icon: 'i-lucide-store' },
  { label: 'Vendedor', value: 'vendedor', icon: 'i-lucide-user-round' },
  { label: 'Pendiente de pago', value: 'pendiente_pago', icon: 'i-lucide-clock' },
  { label: 'Entregado', value: 'entregado', icon: 'i-lucide-truck' },
  { label: 'Facturación', value: 'facturacion', icon: 'i-lucide-receipt-text' },
  { label: 'Cancelado', value: 'cancelado', icon: 'i-lucide-circle-x' },
  { label: 'Internos', value: 'internos', icon: 'i-lucide-building-2' }
]

export const igualacionStatusIcons: Record<string, string> = {
  confirmado: 'i-lucide-circle-check',
  surtido: 'i-lucide-package-check',
  en_espera: 'i-lucide-clock'
}
