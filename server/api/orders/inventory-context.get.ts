import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'

export default eventHandler(async (event) => {
  await requireRole(event, ['admin', 'mostrador', 'vendedor', 'repartidor'])
  const db = usePrisma()
  return { settings: await db.inventorySettings.findUniqueOrThrow({ where: { id: 1 } }), warehouses: await db.inventoryWarehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } }) }
})
