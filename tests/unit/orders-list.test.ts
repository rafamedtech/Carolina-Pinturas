import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppUser } from '../../app/types/siigo'
import { listOrders } from '../../server/utils/orders'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn()
}))

vi.mock('../../server/utils/prisma', () => ({
  usePrisma: () => ({
    salesOrder: {
      findMany: mocks.findMany,
      count: mocks.count,
      aggregate: mocks.aggregate
    }
  })
}))

const admin: AppUser = {
  id: 'admin-1',
  name: 'Administrador',
  email: 'admin@example.com',
  role: 'admin',
  repartidorId: null
}

describe('listado de pedidos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findMany.mockResolvedValue([])
    mocks.count.mockResolvedValue(0)
    mocks.aggregate.mockResolvedValue({ _sum: { total: null } })
  })

  it('filtra por el identificador exacto del cliente', async () => {
    const customerId = '9bf22cf2-ba6b-4030-b9a6-3286ea440b61'

    await listOrders({ page: 1, pageSize: 25, customerId }, admin)

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ customerId }])
      })
    }))
    expect(mocks.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ customerId }])
      })
    }))
  })
})
