import { Prisma } from '../../../generated/prisma/client'
import type { InventorySummary } from '#shared/types/inventory'
import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'
import { getInventoryValuation } from '../../utils/inventoryValuation'

export default eventHandler(async (event): Promise<InventorySummary> => {
  await requireRole(event, ['admin', 'consulta'])
  const db = usePrisma()
  const [valuation, trackedProducts, balances, pendingCounts, activeWarehouses, movements] = await Promise.all([
    getInventoryValuation(),
    db.inventoryProduct.count({ where: { enabled: true, product: { active: true } } }),
    db.$queryRaw<Array<{ stockedProducts: number, reservedProducts: number, lowStockLocations: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT b.product_id) FILTER (WHERE b.quantity > 0)::int AS "stockedProducts",
             COUNT(DISTINCT b.product_id) FILTER (WHERE b.reserved > 0)::int AS "reservedProducts",
             COUNT(*) FILTER (WHERE b.quantity - b.reserved < b.minimum)::int AS "lowStockLocations"
      FROM inventory_balances b
      JOIN siigo_products p ON p.id = b.product_id
      JOIN inventory_products c ON c.product_id = p.id
      WHERE p.active IS TRUE AND c.enabled
    `),
    db.inventoryCount.count({ where: { status: 'borrador' } }),
    db.inventoryWarehouse.count({ where: { active: true } }),
    db.inventoryMovement.findMany({
      orderBy: { folio: 'desc' }, take: 5,
      select: { id: true, folio: true, type: true, date: true, reason: true, actorName: true }
    })
  ])
  return {
    valuation, trackedProducts, pendingCounts, activeWarehouses,
    stockedProducts: balances[0]?.stockedProducts ?? 0,
    reservedProducts: balances[0]?.reservedProducts ?? 0,
    lowStockLocations: balances[0]?.lowStockLocations ?? 0,
    recentMovements: movements.map(movement => ({ ...movement, date: movement.date.toISOString().slice(0, 10) }))
  }
})
