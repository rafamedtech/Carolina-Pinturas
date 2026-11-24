import { calculateInventoryValuation } from '@rafamedtech/nuxt-shared/utils'
import type { InventoryValuation } from '#shared/types/inventory'
import { usePrisma } from './prisma'

export async function getInventoryValuation(): Promise<InventoryValuation> {
  const prisma = usePrisma()
  const warehouses = await prisma.inventoryWarehouse.findMany({
    orderBy: [{ name: 'asc' }, { code: 'asc' }],
    select: {
      id: true,
      code: true,
      name: true,
      balances: {
        where: { quantity: { gt: 0 } },
        select: { productId: true, quantity: true, product: { select: { unitCost: true, costCurrency: true } } }
      }
    }
  })

  const locations = warehouses.map(({ id, code, name }) => ({ id, code, name }))
  const balances = warehouses.flatMap(({ id, balances }) => balances.map(({ productId, quantity, product }) => ({
    warehouseId: id,
    productId,
    quantity: quantity.toString(),
    unitCost: product.unitCost?.toString() ?? null,
    costCurrency: product.costCurrency
  })))
  return calculateInventoryValuation(locations, balances)
}
