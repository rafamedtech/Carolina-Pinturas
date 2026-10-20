// Formas CFDI del selector de recepción de pagos de Siigo México,
// verificadas el 19/10/2026. Son códigos SAT, no IDs configurables del tenant.
// 99 (Por definir) no describe un pago que ya se recibió.
export const SIIGO_PAYMENT_METHODS = [
  { key: 'efectivo', cfdiCode: '01', label: 'Efectivo' },
  { key: 'cheque', cfdiCode: '02', label: 'Cheque nominativo' },
  { key: 'transferencia', cfdiCode: '03', label: 'Transferencia electrónica de fondos' },
  { key: 'tarjeta_credito', cfdiCode: '04', label: 'Tarjeta de crédito' },
  { key: 'monedero_electronico', cfdiCode: '05', label: 'Monedero electrónico' },
  { key: 'dinero_electronico', cfdiCode: '06', label: 'Dinero electrónico' },
  { key: 'vales_despensa', cfdiCode: '08', label: 'Vales de despensa' },
  { key: 'dacion_pago', cfdiCode: '12', label: 'Dación en pago' },
  { key: 'pago_subrogacion', cfdiCode: '13', label: 'Pago por subrogación' },
  { key: 'pago_consignacion', cfdiCode: '14', label: 'Pago por consignación' },
  { key: 'condonacion', cfdiCode: '15', label: 'Condonación' },
  { key: 'compensacion', cfdiCode: '17', label: 'Compensación' },
  { key: 'novacion', cfdiCode: '23', label: 'Novación' },
  { key: 'confusion', cfdiCode: '24', label: 'Confusión' },
  { key: 'remision_deuda', cfdiCode: '25', label: 'Remisión de deuda' },
  { key: 'prescripcion_caducidad', cfdiCode: '26', label: 'Prescripción o caducidad' },
  { key: 'satisfaccion_acreedor', cfdiCode: '27', label: 'A satisfacción del acreedor' },
  { key: 'tarjeta_debito', cfdiCode: '28', label: 'Tarjeta de débito' },
  { key: 'tarjeta_servicios', cfdiCode: '29', label: 'Tarjeta de servicios' },
  { key: 'aplicacion_anticipos', cfdiCode: '30', label: 'Aplicación de anticipos' },
  { key: 'intermediario_pagos', cfdiCode: '31', label: 'Intermediario pagos' }
] as const

export const LEGACY_PAYMENT_METHODS = [
  { key: 'tarjeta', label: 'Tarjeta' },
  { key: 'otro', label: 'Otro' }
] as const

export type PaymentFormKey = typeof SIIGO_PAYMENT_METHODS[number]['key']
export const PAYMENT_FORM_KEYS = SIIGO_PAYMENT_METHODS.map(method => method.key) as PaymentFormKey[]

export function paymentMethodCfdiCode(key: string | null | undefined) {
  return SIIGO_PAYMENT_METHODS.find(method => method.key === key)?.cfdiCode ?? null
}

export function paymentMethodDisplayLabel(key: string | null | undefined) {
  return SIIGO_PAYMENT_METHODS.find(method => method.key === key)?.label
    ?? LEGACY_PAYMENT_METHODS.find(method => method.key === key)?.label
    ?? null
}
