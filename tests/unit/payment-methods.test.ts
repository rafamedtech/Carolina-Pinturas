import { describe, expect, it } from 'vitest'
import { SIIGO_PAYMENT_METHODS, paymentMethodCfdiCode, paymentMethodDisplayLabel } from '../../shared/utils/paymentMethods'
import { paymentMethodLabel, ORDER_PAYMENT_METHODS } from '../../app/utils/orderPayment'
import { createLocalOrderPaymentSchema, paymentMethodFromCfdi } from '../../server/utils/order-payments'

describe('formas de pago compatibles con Siigo México', () => {
  it('incluye las formas del selector de recepciones de Siigo y excluye Por definir', () => {
    expect(SIIGO_PAYMENT_METHODS.map(method => method.cfdiCode)).toEqual([
      '01', '02', '03', '04', '05', '06', '08', '12', '13', '14', '15',
      '17', '23', '24', '25', '26', '27', '28', '29', '30', '31'
    ])
  })

  it('distingue las tarjetas al convertir entre la forma local y el código CFDI', () => {
    expect(paymentMethodCfdiCode('tarjeta_credito')).toBe('04')
    expect(paymentMethodCfdiCode('tarjeta_debito')).toBe('28')
    expect(paymentMethodFromCfdi('04')).toBe('tarjeta_credito')
    expect(paymentMethodFromCfdi('28')).toBe('tarjeta_debito')
    expect(paymentMethodCfdiCode('tarjeta')).toBeNull()
    expect(paymentMethodDisplayLabel('tarjeta')).toBe('Tarjeta')
    expect(paymentMethodLabel('otro')).toBe('Otro')
    expect(ORDER_PAYMENT_METHODS.map(method => method.key)).toContain('tarjeta')
  })

  it.each(SIIGO_PAYMENT_METHODS)('acepta $cfdiCode - $label como pago local', (method) => {
    expect(createLocalOrderPaymentSchema.safeParse({
      destination: 'local', requestId: '19ee1240-591d-4b72-87da-ee034838553c',
      paymentMethod: method.key, amount: 323, date: '2026-10-19'
    }).success).toBe(true)
    expect(paymentMethodLabel(method.key)).toBe(method.label)
  })

  it.each(['tarjeta', 'otro', '99', 'PPD', 'PUE'])('rechaza %s para nuevos pagos sin reclasificar los históricos', (method) => {
    expect(createLocalOrderPaymentSchema.safeParse({
      destination: 'local', requestId: '19ee1240-591d-4b72-87da-ee034838553c',
      paymentMethod: method, amount: 323, date: '2026-10-19'
    }).success).toBe(false)
  })
})
