import { SIIGO_PAYMENT_METHODS, paymentMethodDisplayLabel } from '~~/shared/utils/paymentMethods'
import type { PaymentFormKey } from '~~/shared/utils/paymentMethods'

export { PAYMENT_FORM_KEYS, SIIGO_PAYMENT_METHODS, paymentMethodCfdiCode } from '~~/shared/utils/paymentMethods'
export type { PaymentFormKey } from '~~/shared/utils/paymentMethods'

export const PAYMENT_STATUSES = [
  { key: 'pendiente_pago', label: 'Pendiente de pago', color: 'warning' },
  { key: 'abonado', label: 'Abonado', color: 'info' },
  { key: 'pago_recibido', label: 'Pago recibido', color: 'success' }
] as const

// Catálogo local legado compartido con compras y gastos.
export const PAYMENT_METHODS = [
  { key: 'efectivo', label: 'Efectivo' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'tarjeta', label: 'Tarjeta' },
  { key: 'cheque', label: 'Cheque' },
  { key: 'otro', label: 'Otro' }
] as const

export const ORDER_PAYMENT_METHODS = [
  ...SIIGO_PAYMENT_METHODS,
  ...PAYMENT_METHODS.filter(method => method.key === 'tarjeta' || method.key === 'otro')
]

export type PaymentStatusKey = typeof PAYMENT_STATUSES[number]['key']
export type PaymentMethodKey = typeof PAYMENT_METHODS[number]['key']
export type OrderPaymentMethodKey = PaymentMethodKey | PaymentFormKey

export const PAYMENT_STATUS_KEYS = PAYMENT_STATUSES.map(status => status.key) as PaymentStatusKey[]
export const PAYMENT_METHOD_KEYS = PAYMENT_METHODS.map(method => method.key) as PaymentMethodKey[]
export const ORDER_PAYMENT_METHOD_KEYS = ORDER_PAYMENT_METHODS.map(method => method.key) as OrderPaymentMethodKey[]

export const DEFAULT_PAYMENT_STATUS: PaymentStatusKey = 'pendiente_pago'

export function paymentStatusLabel(key: string | null | undefined) {
  return PAYMENT_STATUSES.find(status => status.key === key)?.label ?? '—'
}

export function paymentStatusColor(key: string | null | undefined) {
  return PAYMENT_STATUSES.find(status => status.key === key)?.color ?? 'neutral'
}

export function paymentMethodLabel(key: string | null | undefined) {
  return paymentMethodDisplayLabel(key) ?? '—'
}

export function canDeletePaymentRecord(
  provider: string,
  externalStatus: string,
  siigoVoucherId: string | null | undefined
) {
  return provider === 'local'
    || (provider === 'siigo' && externalStatus === 'failed' && !siigoVoucherId)
}
