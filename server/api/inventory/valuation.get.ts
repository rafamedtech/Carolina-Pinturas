import { requireRole } from '../../utils/auth'
import { getInventoryValuation } from '../../utils/inventoryValuation'

export default eventHandler(async (event) => {
  await requireRole(event, ['admin'])
  return getInventoryValuation()
})
