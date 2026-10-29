import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { updateOrder } from '../../server/utils/orders'
import { updateOrderSchema } from '../../server/utils/order-validation'
import type { AppUser, SiigoProduct } from '../../app/types/siigo'

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    siigoCustomer: { findUniqueOrThrow: vi.fn() },
    salesOrder: { updateMany: vi.fn() },
    salesOrderItem: { findMany: vi.fn() }
  }
  return {
    tx,
    findFirst: vi.fn(),
    transaction: vi.fn(async (action: (client: typeof tx) => unknown) => action(tx)),
    snapshot: vi.fn(),
    inventory: vi.fn(),
    recipes: vi.fn()
  }
})
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ salesOrder: { findFirst: mocks.findFirst }, $transaction: mocks.transaction }) }))
vi.mock('../../server/utils/siigo-persistence', () => ({
  siigoCustomerDisplayName: () => 'Cliente',
  siigoJson: (value: unknown) => value,
  upsertSiigoCustomer: mocks.snapshot,
  upsertSiigoProduct: mocks.snapshot
}))
vi.mock('../../server/utils/inventory', () => ({ inventorySettings: vi.fn(), assertOrderInventoryEditable: mocks.inventory }))
vi.mock('../../server/utils/product-compositions', () => ({ captureInventoryRecipes: mocks.recipes }))
vi.stubGlobal('createError', createError)

const id = '00000000-0000-4000-8000-000000000001'
const admin: AppUser = { id, name: 'Admin', email: 'admin@example.com', role: 'admin', repartidorId: null }
const customer = { id, name: ['Cliente'] }
const courier = { id, nombre: 'Repartidor', telefono: null, esMostrador: false }
const product: SiigoProduct = { id, code: 'PIN1', name: 'Pintura', prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 100 }] }] }
const input = updateOrderSchema.parse({ customerId: id, repartidorId: id, version: 1, orderDate: '2026-10-28', lines: [{ productId: id, quantity: 1 }] })
const stopAfterUpdate = new Error('Actualización autorizada')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFirst.mockResolvedValue({ statusKey: 'entregado', customerId: id, orderDate: new Date('2026-10-28'), paymentStatus: input.paymentStatus, items: [{ productId: id }] })
  mocks.tx.salesOrderItem.findMany.mockResolvedValue([])
  mocks.tx.siigoCustomer.findUniqueOrThrow.mockResolvedValue({ requiresInvoice: false })
  mocks.recipes.mockResolvedValue(new Map())
  mocks.inventory.mockResolvedValue(undefined)
  mocks.tx.salesOrder.updateMany.mockRejectedValue(stopAfterUpdate)
})

describe('facturación del cliente al actualizar un pedido', () => {
  it.each([
    [true, false, true],
    [true, true, true],
    [false, true, true],
    [false, false, false]
  ])('cliente=%s, pedido=%s: guarda requiere factura=%s', async (customerRequiresInvoice, requiresInvoice, expected) => {
    mocks.tx.siigoCustomer.findUniqueOrThrow.mockResolvedValue({ requiresInvoice: customerRequiresInvoice })
    await expect(updateOrder(id, { ...input, requiresInvoice }, admin, customer, new Map([[id, product]]), courier))
      .rejects.toBe(stopAfterUpdate)
    expect(mocks.tx.siigoCustomer.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id }, select: { requiresInvoice: true } })
    expect(mocks.tx.salesOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requiresInvoice: expected })
    }))
  })
})

describe('edición de pedidos entregados', () => {
  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'] as const)('rechaza a %s antes de escribir', async (role) => {
    await expect(updateOrder(id, input, { ...admin, role }, customer, new Map([[id, product]]), courier))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('permite actualizar al administrador conservando el control de versión y el estado entregado', async () => {
    await expect(updateOrder(id, input, admin, customer, new Map([[id, product]]), courier)).rejects.toBe(stopAfterUpdate)
    expect(mocks.inventory).toHaveBeenCalledWith(mocks.tx, id, input.lines, input.warehouseId)
    expect(mocks.tx.salesOrder.updateMany).toHaveBeenCalledWith({
      where: { id, version: 1 },
      data: expect.not.objectContaining({ statusKey: expect.anything() })
    })
  })

  it('mantiene el bloqueo de entrega concurrente para otros roles', async () => {
    mocks.findFirst.mockResolvedValue({ statusKey: 'confirmado', customerId: id, orderDate: new Date('2026-10-28'), paymentStatus: input.paymentStatus, items: [{ productId: id }] })
    mocks.tx.salesOrder.updateMany.mockResolvedValue({ count: 0 })
    await expect(updateOrder(id, input, { ...admin, role: 'mostrador' }, customer, new Map([[id, product]]), courier))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.tx.salesOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id, version: 1, statusKey: { not: 'entregado' } }
    }))
  })
})
