import { describe, expect, it } from 'vitest'
import {
  createOrderSchema,
  requireOrderInvoiceSchema,
  updateOrderSchema,
  updateOrderItemObservationsSchema,
  updateOrderItemQuantitySchema
} from '../../server/utils/order-validation'

const orderInput = {
  customerId: '048fac97-d25e-4724-bbea-c9c731c22656',
  statusKey: 'ingresado',
  orderDate: '2026-07-29',
  requiresInvoice: false,
  lines: [{
    productId: '5575199d-2c56-4eb8-b470-2acbdaab41be',
    quantity: 1,
    discountType: 'porcentaje' as const,
    discountValue: 0
  }]
}

describe('validación de pedidos', () => {
  it('exige un repartidor para guardar un pedido ingresado', () => {
    const result = createOrderSchema.safeParse(orderInput)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.repartidorId)
        .toContain('Selecciona un repartidor para guardar el pedido.')
    }
  })

  it('mantiene las cotizaciones en borrador sin repartidor', () => {
    const result = createOrderSchema.safeParse({
      ...orderInput,
      statusKey: 'borrador'
    })

    expect(result.success).toBe(true)
  })

  it('acepta los campos editables de un pedido existente', () => {
    const result = updateOrderSchema.safeParse({
      customerId: orderInput.customerId,
      repartidorId: 'bc54ea0f-6e1a-42da-860a-94242847995b',
      orderDate: orderInput.orderDate,
      promisedDate: '2026-07-30',
      observations: 'Entregar por la tarde',
      requiresInvoice: true,
      tags: ['urgente'],
      paymentStatus: 'pendiente_pago',
      paymentMethod: 'efectivo',
      paymentDate: '2026-07-29',
      discountType: 'porcentaje',
      discountValue: 0,
      lines: orderInput.lines,
      version: 2
    })

    expect(result.success).toBe(true)
  })

  it('acepta cantidades positivas al editar una partida', () => {
    expect(updateOrderItemQuantitySchema.safeParse({
      quantity: 2.5,
      version: 1
    }).success).toBe(true)
  })

  it('exige la versión para marcar un pedido como requiere factura', () => {
    expect(requireOrderInvoiceSchema.safeParse({ version: 2 }).success).toBe(true)
    expect(requireOrderInvoiceSchema.safeParse({ version: 0 }).success).toBe(false)
  })

  it('rechaza cantidades en cero al editar una partida', () => {
    const result = updateOrderItemQuantitySchema.safeParse({
      quantity: 0,
      version: 1
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.quantity)
        .toContain('La cantidad debe ser mayor a cero.')
    }
  })

  it('permite actualizar o eliminar las observaciones de una partida', () => {
    expect(updateOrderItemObservationsSchema.safeParse({
      observations: 'Entregar en cubeta separada',
      version: 1
    }).success).toBe(true)
    expect(updateOrderItemObservationsSchema.safeParse({
      observations: null,
      version: 1
    }).success).toBe(true)
  })

  it('limita las observaciones de una partida a 5000 caracteres', () => {
    const result = updateOrderItemObservationsSchema.safeParse({
      observations: 'a'.repeat(5001),
      version: 1
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.observations)
        .toContain('Las observaciones no pueden exceder 5000 caracteres.')
    }
  })
})
