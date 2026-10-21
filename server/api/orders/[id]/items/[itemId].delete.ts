import { requireUser } from '../../../../utils/auth'
import { deleteOrderItem } from '../../../../utils/orders'
import { deleteOrderItemSchema } from '../../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const itemId = getRouterParam(event, 'itemId')
  if (!id || !itemId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido o de la partida.' })
  }
  const parsed = deleteOrderItemSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Revisa la versión del pedido.', data: parsed.error.flatten() })
  }
  return deleteOrderItem(id, itemId, parsed.data, user)
})
