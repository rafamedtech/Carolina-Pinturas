import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { invalidateSiigoCatalog } from '../../../utils/siigo-catalog'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  invalidateSiigoCatalog('customers')

  return { refreshed: true }
})
