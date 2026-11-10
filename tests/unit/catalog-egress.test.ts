import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inventoryQuery } from '../../shared/schemas/inventory'
import { listInventory } from '../../server/utils/inventory'
import { attachProductCompositions } from '../../server/utils/product-compositions'

const mocks = vi.hoisted(() => ({
  siigoProduct: { findMany: vi.fn(), count: vi.fn() },
  inventoryBalance: { findMany: vi.fn(), count: vi.fn() },
  productWrite: { findMany: vi.fn() }
}))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => mocks }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.siigoProduct.count.mockResolvedValue(1)
  mocks.inventoryBalance.count.mockResolvedValue(1)
  mocks.productWrite.findMany.mockResolvedValue([])
})

describe('lecturas de catálogos sin snapshots innecesarios', () => {
  it('mantiene costos, unidades y control de inventario sin descargar raw_payload', async () => {
    mocks.siigoProduct.findMany.mockResolvedValue([{
      id: 'p1', code: 'PIN1', name: 'Pintura', reference: 'REF', barcode: '123',
      unitName: 'Litro', unitCode: 'LTR', unitCost: '12.123456', costCurrency: 'USD',
      initialUnitCost: '10', initialCostCurrency: 'MXN', inventoryProduct: { enabled: true, version: 4 }
    }])
    const result = await listInventory('products', inventoryQuery.parse({}))
    expect(result).toMatchObject({ results: [{
      id: 'p1', reference: 'REF', additional_fields: { barcode: '123' }, unit: 'Litro',
      unitCost: '12.123456', costCurrency: 'USD', initialUnitCost: '10', initialCostCurrency: 'MXN', enabled: true, version: 4
    }] })
    const query = mocks.siigoProduct.findMany.mock.calls[0]![0]
    expect(query.select.rawPayload).toBeUndefined()
    expect(query.include).toBeUndefined()
  })

  it('conserva existencias, reservas y alertas con la proyección reducida', async () => {
    mocks.inventoryBalance.findMany.mockResolvedValue([{
      productId: 'p1', warehouseId: 'w1', quantity: '10.25', reserved: '4.5', minimum: '6', version: 3,
      product: { code: 'PIN1', name: 'Pintura', unitName: null, unitCode: 'LTR', unitCost: '12', costCurrency: 'MXN' },
      warehouse: { name: 'Principal' }
    }])
    expect(await listInventory('stocks', inventoryQuery.parse({}))).toMatchObject({
      results: [{ available: '5.75', low: true, unit: 'LTR', warehouse: 'Principal', unitCost: '12', costCurrency: 'MXN' }]
    })
    const query = mocks.inventoryBalance.findMany.mock.calls[0]![0]
    expect(query.include.product.select.rawPayload).toBeUndefined()
  })

  it('calcula disponibilidad y composición usando solo sus campos internos', async () => {
    mocks.siigoProduct.findMany.mockResolvedValue([{
      id: 'p1', internalKind: 'product', compositionVersion: 2,
      availableForPurchase: true, availableForSale: false, availableForExpense: true,
      inventoryProduct: { enabled: true }, inventoryBalances: [{ quantity: '8.5', reserved: '2' }], internalComponents: []
    }])
    const result = await attachProductCompositions(mocks as unknown as Parameters<typeof attachProductCompositions>[0], [{ id: 'p1', code: 'PIN1', name: 'Pintura' }])
    expect(result[0]?.internal).toMatchObject({
      availability: { purchase: true, sale: false, expense: true },
      inventory: { tracked: true, available: '6.5' }, composition: { kind: 'product', version: 2, components: [] }
    })
    const query = mocks.siigoProduct.findMany.mock.calls[0]![0]
    expect(query.select.rawPayload).toBeUndefined()
    expect(query.include).toBeUndefined()
  })
})
