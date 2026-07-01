import { requireUser } from '../../utils/auth'
import { getOrder } from '../../utils/orders'

export default eventHandler((event) => {
  requireUser(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  return getOrder(id)
})
