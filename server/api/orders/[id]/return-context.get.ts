import { requireRole } from '../../../utils/auth'
import { INVENTORY_WRITE_ROLES, inventoryAssert, orderReturnContext } from '../../../utils/inventory'
import { getOrder } from '../../../utils/orders'

export default eventHandler(async (event) => {
  const user = await requireRole(event, INVENTORY_WRITE_ROLES)
  const order = await getOrder(getRouterParam(event, 'id')!, user)
  inventoryAssert(order.status.key === 'entregado', 'Solo puedes registrar una devolución desde un pedido entregado.')
  return orderReturnContext(order.id)
})
