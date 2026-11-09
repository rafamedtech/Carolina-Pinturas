import type { UserRole } from '~/types/siigo'

export const ORDER_ENTRY_ROLES = [
  'admin',
  'mostrador',
  'vendedor',
  'repartidor'
] as const satisfies readonly UserRole[]

export const ORDER_LOGISTICS_ROLES = [
  'admin',
  'mostrador',
  'vendedor'
] as const satisfies readonly UserRole[]

export const OPERATIONAL_ROLES = [
  ...ORDER_ENTRY_ROLES,
  'igualaciones'
] as const satisfies readonly UserRole[]

const REPARTIDOR_STATUS_KEYS = ['en_espera', 'en_camino', 'entregado'] as const
const IGUALACIONES_STATUS_KEYS = ['confirmado', 'surtido', 'en_espera'] as const
const MOSTRADOR_CREATE_STATUS_KEYS = ['borrador', 'confirmado'] as const
const SALES_CREATE_STATUS_KEYS = ['borrador', 'ingresado'] as const

export function canCreateOrders(role: UserRole) {
  return ORDER_ENTRY_ROLES.includes(role as typeof ORDER_ENTRY_ROLES[number])
}

export function creatableOrderStatusKeys(role: UserRole): readonly string[] | null {
  if (role === 'admin') return null
  if (role === 'mostrador') return MOSTRADOR_CREATE_STATUS_KEYS
  if (role === 'vendedor' || role === 'repartidor') return SALES_CREATE_STATUS_KEYS
  return []
}

export function canCreateOrderWithStatus(role: UserRole, statusKey: string) {
  const allowedStatusKeys = creatableOrderStatusKeys(role)
  return allowedStatusKeys === null || allowedStatusKeys.includes(statusKey)
}

export function submittedOrderStatusKey(role: UserRole, selectedStatusKey: string) {
  if (role === 'mostrador') return 'confirmado'
  if (role === 'vendedor' || role === 'repartidor') return 'ingresado'
  return selectedStatusKey
}

export function canManageOrderLogistics(role: UserRole) {
  return ORDER_LOGISTICS_ROLES.includes(role as typeof ORDER_LOGISTICS_ROLES[number])
}

export function canEditOrderRemision(role: UserRole) {
  return role !== 'igualaciones' && role !== 'consulta'
}

export function editableOrderStatusKeys(role: UserRole): readonly string[] | null {
  if (role === 'consulta') return []
  if (role === 'repartidor') return REPARTIDOR_STATUS_KEYS
  if (role === 'igualaciones') return IGUALACIONES_STATUS_KEYS
  return null
}

export function homePathForRole(role: UserRole) {
  if (role === 'igualaciones') return '/igualaciones'
  if (role === 'repartidor') return '/ventas'
  return '/'
}

export function canAccessAppPath(role: UserRole, path: string) {
  if (role === 'consulta') {
    return !(/^\/configuracion(?:\/|$)/.test(path) || /\/(nuevo(?:-pedido)?|nueva(?:-cotizacion)?|editar)(?:\/|$)/.test(path))
  }
  if (path === '/compras' || path.startsWith('/compras/')) return role === 'admin'
  if (role === 'igualaciones') {
    const isOrderDetail = /^\/ventas\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(path)
    return path === '/igualaciones' || isOrderDetail
  }

  if (role === 'repartidor') {
    return path === '/ventas' || path.startsWith('/ventas/')
  }

  return true
}

export const PRODUCT_MANAGEMENT_ROLES = ['admin'] as const satisfies readonly UserRole[]

export function canManageProducts(role: UserRole | undefined) {
  return role === 'admin'
}

export function canWriteData(role: UserRole | undefined) {
  return Boolean(role && role !== 'consulta')
}

export const USER_ROLE_OPTIONS = [
  { value: 'consulta', label: 'Solo consulta', description: 'Puede consultar la información de todos los módulos. No puede agregar, modificar ni eliminar registros.' },
  { value: 'mostrador', label: 'Mostrador', description: 'Gestiona pedidos, cobros, clientes, gastos y operaciones de inventario.' },
  { value: 'vendedor', label: 'Vendedor', description: 'Gestiona pedidos, cobros, clientes y gastos. Consulta inventario.' },
  { value: 'repartidor', label: 'Repartidor', description: 'Accede a pedidos y actualiza las entregas asignadas.' },
  { value: 'igualaciones', label: 'Igualaciones', description: 'Consulta la cola de igualaciones y actualiza su preparación.' }
] as const

export function canReadAllData(role: UserRole | undefined) {
  return role === 'admin' || role === 'consulta'
}
