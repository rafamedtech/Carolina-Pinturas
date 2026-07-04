export const PAYMENT_STATUSES = [
  { key: 'pendiente_pago', label: 'Pendiente de pago', color: 'warning' },
  { key: 'pago_recibido', label: 'Pago recibido', color: 'success' }
] as const

export const PAYMENT_METHODS = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta', label: 'Tarjeta' }
] as const

export type PaymentStatusKey = typeof PAYMENT_STATUSES[number]['key']
export type PaymentMethodKey = typeof PAYMENT_METHODS[number]['key']

export const PAYMENT_STATUS_KEYS = PAYMENT_STATUSES.map(status => status.key) as PaymentStatusKey[]
export const PAYMENT_METHOD_KEYS = PAYMENT_METHODS.map(method => method.key) as PaymentMethodKey[]

export const DEFAULT_PAYMENT_STATUS: PaymentStatusKey = 'pendiente_pago'

export function paymentStatusLabel(key: string | null | undefined) {
  return PAYMENT_STATUSES.find(status => status.key === key)?.label ?? '—'
}

export function paymentStatusColor(key: string | null | undefined) {
  return PAYMENT_STATUSES.find(status => status.key === key)?.color ?? 'neutral'
}

export function paymentMethodLabel(key: string | null | undefined) {
  return PAYMENT_METHODS.find(method => method.key === key)?.label ?? '—'
}
