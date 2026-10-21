import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { deleteOrderItem } from '../../server/utils/orders'
import { deleteOrderItemSchema } from '../../server/utils/order-validation'
import type { AppUser } from '../../app/types/siigo'

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    salesOrder: { findFirst: vi.fn(), updateMany: vi.fn() },
    salesOrderItem: { delete: vi.fn() },
    salesOrderPayment: { aggregate: vi.fn() },
    inventoryMovement: { findUnique: vi.fn() }
  }
  return { tx, transaction: vi.fn(async (action: (client: typeof tx) => unknown) => action(tx)), settings: vi.fn(), sync: vi.fn() }
})
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ $transaction: mocks.transaction }) }))
vi.mock('../../server/utils/inventory', () => ({ inventorySettings: mocks.settings, syncOrderInventory: mocks.sync }))
vi.stubGlobal('createError', createError)

const user: AppUser = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin', repartidorId: null }
const items = [
  { id: 'item-1', subtotal: '100', discountAmount: '0', taxAmount: '8', total: '108' },
  { id: 'item-2', subtotal: '200', discountAmount: '20', taxAmount: '14.40', total: '194.40' }
]
const order = { statusKey: 'confirmado', version: 1, siigoInvoice: null, discountType: 'porcentaje', discountValue: '10', items }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.tx.salesOrder.findFirst.mockResolvedValue(order)
  mocks.tx.salesOrder.updateMany.mockResolvedValue({ count: 1 })
  mocks.tx.salesOrderPayment.aggregate.mockResolvedValue({ _sum: { amount: '180' } })
  mocks.tx.inventoryMovement.findUnique.mockResolvedValue(null)
})

describe('eliminación de partidas', () => {
  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'] as const)('rechaza al rol %s sin escribir', async (role) => {
    await expect(deleteOrderItem('order-1', 'item-1', { version: 1 }, { ...user, role })).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each(['en_camino', 'entregado'])('bloquea eliminar partidas en estado %s aunque no esté facturado', async (statusKey) => {
    mocks.tx.salesOrder.findFirst.mockResolvedValue({ ...order, statusKey })
    await expect(deleteOrderItem('order-1', 'item-1', { version: 1 }, user)).rejects.toMatchObject({
      statusCode: 409, statusMessage: 'No se pueden eliminar partidas de un pedido en camino o entregado.'
    })
    expect(mocks.tx.salesOrderItem.delete).not.toHaveBeenCalled()
    expect(mocks.tx.salesOrder.updateMany).not.toHaveBeenCalled()
    expect(mocks.tx.salesOrderPayment.aggregate).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it.each(['ingresado', 'confirmado', 'surtido', 'en_espera'])('permite eliminar sin factura en estado %s', async (statusKey) => {
    mocks.tx.salesOrder.findFirst.mockResolvedValue({ ...order, statusKey })
    await expect(deleteOrderItem('order-1', 'item-1', { version: 1 }, user)).resolves.toEqual({ id: 'item-1' })
  })

  it.each(['created', 'pending', 'creating', 'uncertain'])('bloquea una factura con estado %s', async (status) => {
    mocks.tx.salesOrder.findFirst.mockResolvedValue({ ...order, siigoInvoice: { status } })
    await expect(deleteOrderItem('order-1', 'item-1', { version: 1 }, user)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.tx.salesOrderItem.delete).not.toHaveBeenCalled()
    expect(mocks.tx.salesOrder.updateMany).not.toHaveBeenCalled()
  })

  it('elimina la partida, recalcula descuentos e IVA y actualiza el pago y las reservas', async () => {
    await expect(deleteOrderItem('order-1', 'item-1', { version: 1 }, user)).resolves.toEqual({ id: 'item-1' })
    expect(mocks.tx.salesOrderItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } })
    expect(mocks.tx.salesOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', version: 1, statusKey: { notIn: ['en_camino', 'entregado'] }, OR: [{ siigoInvoice: null }, { siigoInvoice: { status: 'failed' } }] },
      data: {
        subtotal: '200', discountAmount: '19.44', discountTotal: '39.44', taxTotal: '14.4', total: '174.96',
        paymentStatus: 'pago_recibido', updatedByEmail: user.email, version: { increment: 1 }
      }
    })
    expect(mocks.sync).toHaveBeenCalledWith(mocks.tx, 'order-1', user)
  })

  it('conserva la salida de inventario cuando la partida ya fue surtida', async () => {
    mocks.tx.inventoryMovement.findUnique.mockResolvedValue({ id: 'dispatch-1' })
    await deleteOrderItem('order-1', 'item-1', { version: 1 }, user)
    expect(mocks.tx.salesOrderItem.delete).toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('permite eliminar si la solicitud de factura falló', async () => {
    mocks.tx.salesOrder.findFirst.mockResolvedValue({ ...order, siigoInvoice: { status: 'failed' } })
    await expect(deleteOrderItem('order-1', 'item-1', { version: 1 }, user)).resolves.toEqual({ id: 'item-1' })
  })

  it.each([
    ['pedido inexistente', null, 404],
    ['partida inexistente', { ...order, items: [items[1]] }, 404],
    ['última partida', { ...order, items: [items[0]] }, 409],
    ['versión desactualizada', { ...order, version: 2 }, 409]
  ])('rechaza %s', async (_label, currentOrder, statusCode) => {
    mocks.tx.salesOrder.findFirst.mockResolvedValue(currentOrder)
    await expect(deleteOrderItem('order-1', 'item-1', { version: 1 }, user)).rejects.toMatchObject({ statusCode })
    expect(mocks.tx.salesOrderItem.delete).not.toHaveBeenCalled()
  })

  it('rechaza cambios concurrentes antes de eliminar', async () => {
    mocks.tx.salesOrder.updateMany.mockResolvedValue({ count: 0 })
    await expect(deleteOrderItem('order-1', 'item-1', { version: 1 }, user)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.tx.salesOrderItem.delete).not.toHaveBeenCalled()
  })

  it('exige una versión válida', () => {
    for (const version of [undefined, null, 0, -1, 1.5, '1']) {
      expect(deleteOrderItemSchema.safeParse({ version }).success).toBe(false)
    }
    expect(deleteOrderItemSchema.safeParse({ version: 1 }).success).toBe(true)
  })
})
