import { requireUser } from '../../../utils/auth'
import { getOrder } from '../../../utils/orders'
import { orderInventoryView } from '../../../utils/inventory'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  await getOrder(id, user)
  return orderInventoryView(id)
})
