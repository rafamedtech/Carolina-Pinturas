import * as z from 'zod'
import { canReadAllData, ORDER_LOGISTICS_ROLES, PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { productActivitySections } from '#shared/types/product-activity'
import { requireRole } from '../../../utils/auth'
import { INVENTORY_READ_ROLES, INVENTORY_WRITE_ROLES } from '../../../utils/inventory'
import { listProductActivity } from '../../../utils/product-activity'

const activityQuery = z.object({
  section: z.enum(productActivitySections),
  page: z.coerce.number().int().min(1).max(100_000).default(1)
})

const roles = {
  sales: ORDER_LOGISTICS_ROLES,
  purchases: PRODUCT_MANAGEMENT_ROLES,
  receipts: PRODUCT_MANAGEMENT_ROLES,
  movements: INVENTORY_READ_ROLES,
  reservations: INVENTORY_READ_ROLES,
  counts: INVENTORY_WRITE_ROLES,
  expenses: ORDER_LOGISTICS_ROLES
} as const

export default eventHandler(async (event) => {
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const query = activityQuery.safeParse(getQuery(event))
  if (!id.success || !query.success) {
    throw createError({ statusCode: 400, statusMessage: 'Revisa los filtros de actividad del producto.' })
  }

  const { section, page } = query.data
  const user = await requireRole(event, roles[section])
  return listProductActivity(id.data, section, page, canReadAllData(user.role))
})
