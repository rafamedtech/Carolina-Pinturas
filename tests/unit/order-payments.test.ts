import { describe, expect, it } from 'vitest'
import {
  assertInitialLocalPaymentAllowed,
  assertPaymentFitsBalance,
  createOrderPaymentSchema,
  paymentDestinationForOrder,
  paymentMethodFromCfdi,
  paymentStatus
} from '../../server/utils/order-payments'
import { createOrderSchema } from '../../server/utils/order-validation'

const requestId = '19ee1240-591d-4b72-87da-ee034838553c'
const orderInput = {
  customerId: '048fac97-d25e-4724-bbea-c9c731c22656',
  repartidorId: '86ea1868-3756-48d2-91a2-e5454f328b3c',
  statusKey: 'ingresado',
  orderDate: '2026-07-28',
  requiresInvoice: false,
  lines: [{
    productId: '5575199d-2c56-4eb8-b470-2acbdaab41be',
    quantity: 1,
    discountType: 'porcentaje' as const,
    discountValue: 0
  }]
}

describe('pagos unificados de pedidos', () => {
  it('determina el destino según si el pedido requiere factura', () => {
    expect(paymentDestinationForOrder(false)).toBe('local')
    expect(paymentDestinationForOrder(true)).toBe('siigo')
  })

  it('acepta pagos locales sin RFC ni referencias fiscales', () => {
    expect(createOrderPaymentSchema.safeParse({
      destination: 'local',
      requestId,
      paymentMethod: 'efectivo',
      amount: 250.50,
      date: '2026-07-28',
      reference: 'CAJA-123',
      observations: null
    }).success).toBe(true)
  })

  it('rechaza importes con más de dos decimales y claves idempotentes inválidas', () => {
    expect(createOrderPaymentSchema.safeParse({
      destination: 'local',
      requestId,
      paymentMethod: 'transferencia',
      amount: 10.001,
      date: '2026-07-28'
    }).success).toBe(false)
    expect(createOrderPaymentSchema.safeParse({
      destination: 'local',
      requestId: 'repetible-pero-no-uuid',
      paymentMethod: 'transferencia',
      amount: 10,
      date: '2026-07-28'
    }).success).toBe(false)
  })

  it('calcula el estado del pedido con pagos parciales y completos', () => {
    expect(paymentStatus(0, 500)).toBe('pendiente_pago')
    expect(paymentStatus(100, 500)).toBe('abonado')
    expect(paymentStatus(500, 500)).toBe('pago_recibido')
  })

  it('impide registrar más que el saldo pendiente', () => {
    expect(() => assertPaymentFitsBalance(300, 200, 500)).not.toThrow()
    expect(() => assertPaymentFitsBalance(300.01, 200, 500)).toThrow()
  })

  it('conserva una traducción local para las formas CFDI de Siigo', () => {
    expect(paymentMethodFromCfdi('01')).toBe('efectivo')
    expect(paymentMethodFromCfdi('02')).toBe('cheque')
    expect(paymentMethodFromCfdi('03')).toBe('transferencia')
    expect(paymentMethodFromCfdi('28')).toBe('tarjeta')
    expect(paymentMethodFromCfdi('99')).toBe('otro')
  })

  it('acepta la instrucción idempotente de pago inicial sin recibir el importe del navegador', () => {
    const result = createOrderSchema.safeParse({
      ...orderInput,
      initialPayment: {
        requestId,
        paymentMethod: 'tarjeta',
        date: '2026-07-28'
      }
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.initialPayment).not.toHaveProperty('amount')
  })

  it('permite el pago inicial local en pedidos sin factura', () => {
    expect(() => assertInitialLocalPaymentAllowed(false)).not.toThrow()
    expect(() => assertInitialLocalPaymentAllowed(true)).toThrow()
  })
})
