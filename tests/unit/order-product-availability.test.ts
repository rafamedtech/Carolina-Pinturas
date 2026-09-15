import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { createOrder, updateOrder } from '../../server/utils/orders'
import { createOrderSchema, updateOrderSchema } from '../../server/utils/order-validation'
import type { AppUser, SiigoProduct } from '../../app/types/siigo'

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), transaction: vi.fn(), snapshot: vi.fn() }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ salesOrder: { findFirst: mocks.findFirst }, $transaction: mocks.transaction }) }))
vi.mock('../../server/utils/siigo-persistence', () => ({
  siigoCustomerDisplayName: () => 'Cliente',
  siigoJson: (value: unknown) => value, upsertSiigoCustomer: mocks.snapshot, upsertSiigoProduct: mocks.snapshot
}))
vi.stubGlobal('createError', createError)
const id = '00000000-0000-4000-8000-000000000001'
const admin: AppUser = { id, name: 'Admin', email: 'test@example.com', role: 'admin', repartidorId: null }
const customer = { id, name: ['Cliente'] }
const product: SiigoProduct = { id, code: 'PIN1', name: 'Pintura', active: false, prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 100 }] }] }
const raw = { customerId: id, orderDate: '2026-09-15', statusKey: 'borrador', lines: [{ productId: id, quantity: 1 }] }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFirst.mockResolvedValue({ statusKey: 'borrador', items: [] })
  mocks.transaction.mockRejectedValue(new Error('Transacción simulada alcanzada'))
})
describe('productos inactivos en pedidos', () => {
  it('no crea pedidos con producto desactivado ni escribe snapshots', async () => {
    await expect(createOrder(createOrderSchema.parse(raw), admin, customer, new Map([[id, product]]), null)).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it('no incorpora un producto inactivo nuevo a un pedido existente', async () => {
    await expect(updateOrder(id, updateOrderSchema.parse({ ...raw, version: 1 }), admin, customer, new Map([[id, product]]), null)).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it('no bloquea edición de un pedido que ya contenía ese producto', async () => {
    mocks.findFirst.mockResolvedValue({ statusKey: 'borrador', items: [{ productId: id }] })
    await expect(updateOrder(id, updateOrderSchema.parse({ ...raw, version: 1 }), admin, customer, new Map([[id, product]]), null)).rejects.toThrow('Transacción simulada alcanzada')
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })
})
