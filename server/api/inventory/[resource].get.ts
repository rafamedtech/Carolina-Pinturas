import { inventoryQuery } from '#shared/schemas/inventory'
import { requireRole } from '../../utils/auth'
import { INVENTORY_READ_ROLES, INVENTORY_WRITE_ROLES, listInventory } from '../../utils/inventory'

export default eventHandler(async (event) => {
  const resource = getRouterParam(event, 'resource') ?? ''
  await requireRole(event, resource === 'counts' || resource === 'movements' ? INVENTORY_WRITE_ROLES : INVENTORY_READ_ROLES)
  const parsed = inventoryQuery.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los filtros.', data: parsed.error.flatten() })
  return listInventory(resource, parsed.data)
})
