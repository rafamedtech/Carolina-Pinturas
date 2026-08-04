import { requireUser } from '../../../../../utils/auth'
import { updateOrderItemQuantity } from '../../../../../utils/orders'
import { updateOrderItemQuantitySchema } from '../../../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const itemId = getRouterParam(event, 'itemId')

  if (!id || !itemId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido o de la partida.' })
  }

  const parsed = updateOrderItemQuantitySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa la cantidad ingresada.',
      data: parsed.error.flatten()
    })
  }

  return updateOrderItemQuantity(id, itemId, parsed.data, user)
})
