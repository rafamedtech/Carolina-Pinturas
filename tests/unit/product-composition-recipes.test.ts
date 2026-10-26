import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '../../generated/prisma/client'
import { captureInventoryRecipes, validateComposition } from '../../server/utils/product-compositions'

const kitId = '00000000-0000-4000-8000-000000000001'
const componentId = '00000000-0000-4000-8000-000000000002'

function fixture(overrides = {}) {
  const component = {
    id: componentId, code: 'LEGACY-OLD', name: 'Componente anterior',
    internalKind: 'product', type: 'Product', active: false,
    unitName: 'Litro', unitCode: 'LTR', inventoryProduct: { enabled: true },
    ...overrides
  }
  const kit = {
    id: kitId, code: 'KIT', name: 'Kit', internalKind: 'composite',
    availableForSale: true,
    internalComponents: [{ componentId, quantity: '0.5', component }]
  }
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    siigoProduct: { findMany: vi.fn<() => Promise<unknown[]>>().mockResolvedValue([kit]) },
    productWrite: { count: vi.fn().mockResolvedValue(0) }
  }
  return { db, component, tx: db as unknown as Prisma.TransactionClient }
}

describe('recetas de inventario de kits existentes', () => {
  it('conserva el componente inactivo y su consumo al guardar el pedido', async () => {
    const { tx } = fixture()
    const recipes = await captureInventoryRecipes(tx, [kitId])

    expect(recipes.get(kitId)).toEqual([{
      productId: componentId, quantity: '0.5', code: 'LEGACY-OLD',
      name: 'Componente anterior', unit: 'Litro'
    }])
  })

  it.each([
    { internalKind: 'composite' },
    { type: 'Service' },
    { inventoryProduct: { enabled: false } },
    { inventoryProduct: null }
  ])('rechaza componentes incompatibles con inventario: %j', async (overrides) => {
    const { tx } = fixture(overrides)
    await expect(captureInventoryRecipes(tx, [kitId])).rejects.toThrow('productos simples y con control interno')
  })

  it('sigue rechazando componentes inactivos al definir una composición nueva', async () => {
    const { tx, db, component } = fixture()
    db.siigoProduct.findMany.mockResolvedValue([component])

    await expect(validateComposition(tx, {
      kind: 'composite', version: 1,
      components: [{ productId: componentId, quantity: '0.5' }]
    })).rejects.toThrow('productos simples, activos')
  })

  it('bloquea el componente cuando tiene una escritura pendiente de conciliar', async () => {
    const { tx, db } = fixture()
    db.productWrite.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1)
    await expect(captureInventoryRecipes(tx, [kitId])).rejects.toThrow('guardado pendiente')
  })
})
