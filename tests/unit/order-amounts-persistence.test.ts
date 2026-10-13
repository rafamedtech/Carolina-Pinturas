import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOrder } from '../../server/utils/orders'
import { createOrderSchema } from '../../server/utils/order-validation'
import type { AppUser, SiigoProduct } from '../../app/types/siigo'

const mocks = vi.hoisted(() => ({
  order: vi.fn(), items: vi.fn(), payment: vi.fn(), history: vi.fn()
}))
vi.mock('../../server/utils/prisma', () => ({
  usePrisma: () => ({ orderStatus: { findFirst: async () => ({ key: 'completado' }) } })
}))
vi.mock('../../server/utils/siigo-persistence', () => ({
  siigoCustomerDisplayName: () => 'Cliente', siigoJson: (value: unknown) => value,
  upsertSiigoCustomer: vi.fn(), upsertSiigoProduct: vi.fn()
}))
vi.mock('../../server/utils/inventory', () => ({
  inventorySettings: async () => ({ enabledAt: null }), syncOrderInventory: vi.fn(),
  inventoryRequest: async (_input: unknown, _user: unknown, action: (tx: unknown) => Promise<unknown>) => {
    await action({
      salesOrder: { create: mocks.order }, salesOrderItem: { createMany: mocks.items },
      salesOrderPayment: { create: mocks.payment }, salesOrderStatusHistory: { create: mocks.history }
    })
    throw new Error('Fin de la persistencia simulada')
  }
}))

const id = '00000000-0000-4000-8000-000000000001'
const user: AppUser = { id, name: 'Admin', email: 'test@example.com', role: 'admin', repartidorId: null }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.order.mockResolvedValue({ id })
})

describe('persistencia de los centavos del pedido y su pago inicial', () => {
  it.each([[8, '299.99', '277.77', '22.22'], [16, '300.01', '258.63', '41.38']])(
    'guarda exactamente el mismo total en pedido, partida y pago (IVA %s)', async (rate, total, subtotal, tax) => {
      const product: SiigoProduct = {
        id, code: 'P1', name: 'Pintura', active: true, tax_included: true,
        prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 100 }] }],
        taxes: [{ id: 1, percentage: Number(rate) }]
      }
      const input = createOrderSchema.parse({
        customerId: id, repartidorId: id, orderDate: '2026-10-13', requiresInvoice: true,
        lines: [{ productId: id, quantity: 3 }],
        initialPayment: { requestId: id, paymentMethod: 'efectivo', date: '2026-10-13' }
      })
      await expect(createOrder(input, user, { id, name: ['Cliente'] }, new Map([[id, product]]), {
        id, nombre: 'Mostrador', telefono: null, esMostrador: true
      })).rejects.toThrow('Fin de la persistencia simulada')
      expect(mocks.order).toHaveBeenCalledWith({ data: expect.objectContaining({
        total, subtotal, taxTotal: tax, paymentStatus: 'pago_recibido'
      }) })
      expect(mocks.items).toHaveBeenCalledWith({ data: [expect.objectContaining({ total, subtotal, taxAmount: tax })] })
      expect(mocks.payment).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: total }) })
    }
  )
})
