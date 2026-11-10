import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(), valuation: vi.fn(), products: vi.fn(), balances: vi.fn(), counts: vi.fn(), warehouses: vi.fn(), movements: vi.fn()
}))
vi.mock('../../server/utils/auth', () => ({ requireRole: mocks.requireRole }))
vi.mock('../../server/utils/inventoryValuation', () => ({ getInventoryValuation: mocks.valuation }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({
  inventoryProduct: { count: mocks.products },
  $queryRaw: mocks.balances,
  inventoryCount: { count: mocks.counts },
  inventoryWarehouse: { count: mocks.warehouses },
  inventoryMovement: { findMany: mocks.movements }
}) }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
const handler = (await import('../../server/api/inventory/summary.get')).default
const event = {} as Parameters<typeof handler>[0]

beforeEach(() => {
  vi.resetAllMocks()
  mocks.valuation.mockResolvedValue({ totals: [], productsWithoutCost: 0, warehouses: [] })
  mocks.products.mockResolvedValue(0)
  mocks.balances.mockResolvedValue([{ stockedProducts: 0, reservedProducts: 0, lowStockLocations: 0 }])
  mocks.counts.mockResolvedValue(0)
  mocks.warehouses.mockResolvedValue(0)
  mocks.movements.mockResolvedValue([])
})

describe('inventory summary', () => {
  it('returns real zeros and empty collections before inventory has been registered', async () => {
    expect(await handler(event)).toEqual({
      valuation: { totals: [], productsWithoutCost: 0, warehouses: [] },
      trackedProducts: 0, stockedProducts: 0, reservedProducts: 0, lowStockLocations: 0,
      pendingCounts: 0, activeWarehouses: 0, recentMovements: []
    })
  })

  it('preserves separate currencies, missing costs and the movement calendar date', async () => {
    const valuation = { totals: [{ currencyCode: 'MXN', amount: 1200 }, { currencyCode: 'USD', amount: 35 }], productsWithoutCost: 2, warehouses: [] }
    mocks.valuation.mockResolvedValue(valuation)
    mocks.products.mockResolvedValue(12)
    mocks.balances.mockResolvedValue([{ stockedProducts: 9, reservedProducts: 4, lowStockLocations: 3 }])
    mocks.counts.mockResolvedValue(2)
    mocks.warehouses.mockResolvedValue(4)
    mocks.movements.mockResolvedValue([{ id: 'movement-1', folio: 7, type: 'entrada', date: new Date('2026-11-09T00:00:00Z'), reason: 'Ingreso', actorName: 'Admin' }])
    const result = await handler(event)
    expect(result).toMatchObject({ valuation, trackedProducts: 12, stockedProducts: 9, reservedProducts: 4, lowStockLocations: 3, pendingCounts: 2, activeWarehouses: 4 })
    expect(result.recentMovements[0]?.date).toBe('2026-11-09')
    expect(mocks.movements).toHaveBeenCalledWith(expect.objectContaining({ take: 5, orderBy: { folio: 'desc' } }))
  })

  it('checks access before reading any inventory data', async () => {
    mocks.requireRole.mockRejectedValue(new Error('No autorizado'))
    await expect(handler(event)).rejects.toThrow('No autorizado')
    expect(mocks.valuation).not.toHaveBeenCalled()
    expect(mocks.balances).not.toHaveBeenCalled()
  })
})
