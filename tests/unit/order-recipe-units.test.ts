import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '../../generated/prisma/client'
import type { SalesOrderItem } from '../../app/types/orders'
import { fillOrderRecipeUnits } from '../../server/utils/order-recipe-units'
import { productUnitLabel } from '../../server/utils/product-unit'

describe('unidades de componentes del pedido', () => {
  it.each([
    [{ unitName: 'Litro', unitCode: 'LTR' }, 'Litro'],
    [{ unitName: '', unitCode: 'LTR' }, 'LTR'],
    [{ unitName: null, unitCode: null, rawPayload: { unit: 'H87' } }, 'H87'],
    [{ unitName: null, unitCode: null, rawPayload: { unit: { name: 'Pieza', code: 'H87' } } }, 'Pieza'],
    [{ unitName: null, unitCode: null, rawPayload: { unit: {} } }, null]
  ])('resuelve la unidad desde %j', (product, expected) => {
    expect(productUnitLabel(product)).toBe(expected)
  })

  it('recupera unidades faltantes en una consulta y conserva los snapshots existentes', async () => {
    const recipe = [
      { productId: 'a', quantity: '2', name: 'Catalizador', code: 'CAT', unit: null },
      { productId: 'b', quantity: '4', name: 'Thinner', code: 'TH', unit: '' },
      { productId: 'c', quantity: '1', name: 'Transparente', code: 'TR', unit: 'Litro histórico' }
    ]
    const items = [{ inventoryRecipe: recipe }] as SalesOrderItem[]
    const findMany = vi.fn().mockResolvedValue([
      { id: 'a', unitName: 'Pieza', unitCode: 'H87' },
      { id: 'b', unitName: null, unitCode: null, rawPayload: { unit: 'LTR' } }
    ])
    const db = { siigoProduct: { findMany } } as unknown as PrismaClient
    await fillOrderRecipeUnits(db, items)
    expect(findMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: { in: ['a', 'b'] } },
      select: { id: true, unitName: true, unitCode: true, rawPayload: true }
    })
    expect(recipe.map(component => component.unit)).toEqual(['Pieza', 'LTR', 'Litro histórico'])
    expect(recipe.map(component => component.quantity)).toEqual(['2', '4', '1'])
  })

  it('omite la consulta cuando todas las unidades ya existen', async () => {
    const findMany = vi.fn()
    const db = { siigoProduct: { findMany } } as unknown as PrismaClient
    await fillOrderRecipeUnits(db, [{ inventoryRecipe: [{ unit: 'Pieza' }] }] as SalesOrderItem[])
    expect(findMany).not.toHaveBeenCalled()
  })
})
