import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { updateOrderStatus } from '../../server/utils/orders'
import type { AppUser } from '../../app/types/siigo'

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    salesOrder: { findFirst: vi.fn(), updateMany: vi.fn() },
    orderStatus: { findFirst: vi.fn() }
  }
  return { tx, transaction: vi.fn(async (action: (client: typeof tx) => unknown) => action(tx)), sync: vi.fn() }
})
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ $transaction: mocks.transaction }) }))
vi.mock('../../server/utils/inventory', () => ({ syncOrderInventory: mocks.sync }))
vi.stubGlobal('createError', createError)

const user: AppUser = { id: 'user-1', name: 'Usuario', email: 'user@example.com', role: 'admin', repartidorId: null }
const stopAfterUpdate = new Error('Actualización autorizada; detener simulación')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.tx.salesOrder.findFirst.mockResolvedValue({ statusKey: 'entregado', version: 1, repartidorId: 'driver-1' })
  mocks.tx.orderStatus.findFirst.mockResolvedValue({ key: 'en_espera' })
  mocks.tx.salesOrder.updateMany.mockResolvedValue({ count: 1 })
  mocks.sync.mockRejectedValue(stopAfterUpdate)
})

describe('cambios de estado después de la entrega', () => {
  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'] as const)('rechaza a %s antes de modificar el pedido', async (role) => {
    await expect(updateOrderStatus('order-1', { statusKey: 'en_espera', version: 1 }, { ...user, role }))
      .rejects.toMatchObject({ statusCode: 403, statusMessage: 'Solo un administrador puede cambiar el estado de un pedido entregado.' })
    expect(mocks.tx.salesOrder.updateMany).not.toHaveBeenCalled()
    expect(mocks.sync).not.toHaveBeenCalled()
  })

  it('permite al administrador cambiar un pedido entregado', async () => {
    await expect(updateOrderStatus('order-1', { statusKey: 'en_espera', version: 1 }, user)).rejects.toBe(stopAfterUpdate)
    expect(mocks.tx.salesOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ statusKey: 'en_espera' })
    }))
  })

  it.each(['mostrador', 'vendedor', 'repartidor'] as const)('permite a %s marcar como entregado antes de la entrega', async (role) => {
    mocks.tx.salesOrder.findFirst.mockResolvedValue({ statusKey: 'en_camino', version: 1, repartidorId: 'driver-1' })
    mocks.tx.orderStatus.findFirst.mockResolvedValue({ key: 'entregado' })
    await expect(updateOrderStatus('order-1', { statusKey: 'entregado', version: 1 }, { ...user, role })).rejects.toBe(stopAfterUpdate)
    expect(mocks.tx.salesOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ statusKey: 'entregado' })
    }))
  })
})
