import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { updateOrderItemPrice, updateOrderItemQuantity, updateOrderRepartidor } from '../../server/utils/orders'
import type { AppUser } from '../../app/types/siigo'

const mocks = vi.hoisted(() => ({ order: vi.fn(), driver: vi.fn(), update: vi.fn(), item: vi.fn() }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({
  salesOrder: { findFirst: mocks.order, updateMany: mocks.update },
  repartidor: { findUnique: mocks.driver },
  salesOrderItem: { findFirst: mocks.item }
}) }))
vi.stubGlobal('createError', createError)

const user: AppUser = { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'admin', repartidorId: null }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.order.mockResolvedValue({ statusKey: 'entregado', version: 1 })
  mocks.driver.mockResolvedValue({ id: 'driver-2', nombre: 'Repartidor', telefono: null })
})

describe('permisos del detalle del pedido', () => {
  it.each(['admin', 'mostrador', 'vendedor'] as const)('impide a %s reasignar un pedido entregado', async (role) => {
    await expect(updateOrderRepartidor('order-1', { repartidorId: 'driver-2', version: 1 }, { ...user, role }))
      .rejects.toMatchObject({ statusCode: 409, statusMessage: 'No se puede cambiar el repartidor de un pedido entregado.' })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('permite reasignar antes de la entrega y protege contra entregas concurrentes', async () => {
    mocks.order.mockResolvedValue({ statusKey: 'en_camino', version: 1 })
    mocks.update.mockResolvedValue({ count: 0 })
    await expect(updateOrderRepartidor('order-1', { repartidorId: 'driver-2', version: 1 }, user))
      .rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'order-1', version: 1, statusKey: { not: 'entregado' } }
    }))
  })

  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'] as const)('impide a %s modificar cantidades y precios', async (role) => {
    await expect(updateOrderItemPrice('order-1', 'item-1', { unitPrice: 150, version: 1 }, { ...user, role }))
      .rejects.toMatchObject({ statusCode: 403 })
    await expect(updateOrderItemQuantity('order-1', 'item-1', { quantity: 2, version: 1 }, { ...user, role }))
      .rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.order).not.toHaveBeenCalled()
    expect(mocks.item).not.toHaveBeenCalled()
  })

  it('permite al administrador acceder a la edición de cantidades y precios', async () => {
    mocks.item.mockResolvedValue(null)
    await expect(updateOrderItemPrice('order-1', 'item-1', { unitPrice: 150, version: 1 }, user))
      .rejects.toMatchObject({ statusCode: 404, statusMessage: 'No se encontró la partida.' })
    await expect(updateOrderItemQuantity('order-1', 'item-1', { quantity: 2, version: 1 }, user))
      .rejects.toMatchObject({ statusCode: 404, statusMessage: 'No se encontró la partida.' })
    expect(mocks.item).toHaveBeenCalledTimes(2)
  })
})
