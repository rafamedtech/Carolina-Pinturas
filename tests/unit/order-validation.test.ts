import { describe, expect, it } from 'vitest'
import {
  createOrderSchema,
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

  it('acepta cantidades positivas al editar una partida', () => {
    expect(updateOrderItemQuantitySchema.safeParse({
      quantity: 2.5,
      version: 1
    }).success).toBe(true)
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
})
