import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteOrderPayment } from '../../server/utils/order-payments'
import type { AppUser } from '../../app/types/siigo'

const mocks = vi.hoisted(() => {
  const tx = {
    salesOrder: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    salesOrderPayment: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn()
    }
  }

  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
  }
})

vi.mock('../../server/utils/prisma', () => ({
  usePrisma: () => ({ $transaction: mocks.transaction })
}))

const admin: AppUser = {
  id: 'admin-1',
  name: 'Administrador',
  email: 'admin@example.com',
  role: 'admin',
  repartidorId: null
}

describe('eliminación de pagos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tx.salesOrder.findUnique.mockResolvedValue({ total: { toString: () => '500' } })
    mocks.tx.salesOrderPayment.findFirst
      .mockResolvedValueOnce({
        id: 'payment-1',
        provider: 'local',
        externalStatus: 'not_applicable',
        siigoVoucherId: null
      })
      .mockResolvedValueOnce({
        paymentMethod: 'transferencia',
        paymentDate: new Date('2026-08-03T00:00:00.000Z')
      })
    mocks.tx.salesOrderPayment.delete.mockResolvedValue({ id: 'payment-1' })
    mocks.tx.salesOrderPayment.aggregate.mockResolvedValue({
      _sum: { amount: { toString: () => '100' } }
    })
    mocks.tx.salesOrder.update.mockResolvedValue({ id: 'order-1' })
  })

  it('elimina el pago y recalcula el resumen con los pagos restantes', async () => {
    await expect(deleteOrderPayment('order-1', 'payment-1', admin))
      .resolves.toEqual({ id: 'payment-1' })

    expect(mocks.tx.salesOrderPayment.delete).toHaveBeenCalledWith({
      where: { id: 'payment-1' }
    })
    expect(mocks.tx.salesOrder.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        paymentStatus: 'abonado',
        paymentMethod: 'transferencia',
        paymentDate: new Date('2026-08-03T00:00:00.000Z'),
        updatedByEmail: admin.email,
        version: { increment: 1 }
      }
    })
  })

  it('limpia método y fecha cuando se elimina el último pago', async () => {
    mocks.tx.salesOrderPayment.findFirst.mockReset()
      .mockResolvedValueOnce({
        id: 'payment-1',
        provider: 'local',
        externalStatus: 'not_applicable',
        siigoVoucherId: null
      })
      .mockResolvedValueOnce(null)
    mocks.tx.salesOrderPayment.aggregate.mockResolvedValue({ _sum: { amount: null } })

    await deleteOrderPayment('order-1', 'payment-1', admin)

    expect(mocks.tx.salesOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        paymentStatus: 'pendiente_pago',
        paymentMethod: null,
        paymentDate: null
      })
    }))
  })
})
