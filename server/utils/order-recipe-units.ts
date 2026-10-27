import type { PrismaClient } from '../../generated/prisma/client'
import type { SalesOrderItem } from '~/types/orders'
import { productUnitLabel } from './product-unit'

export async function fillOrderRecipeUnits(db: PrismaClient, items: SalesOrderItem[]) {
  const ids = [...new Set(items.flatMap(item => (item.inventoryRecipe ?? [])
    .filter(component => !component.unit?.trim()).map(component => component.productId)))]
  if (!ids.length) return
  const products = await db.siigoProduct.findMany({
    where: { id: { in: ids } },
    select: { id: true, unitName: true, unitCode: true, rawPayload: true }
  })
  const units = new Map(products.map(product => [product.id, productUnitLabel(product)]))
  for (const item of items) {
    for (const component of item.inventoryRecipe ?? []) {
      if (!component.unit?.trim()) component.unit = units.get(component.productId) ?? null
    }
  }
}
