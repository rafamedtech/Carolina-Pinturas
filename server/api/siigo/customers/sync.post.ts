import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { synchronizeSiigoCustomers } from '../../../utils/siigo-customer-import'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  return synchronizeSiigoCustomers()
})
