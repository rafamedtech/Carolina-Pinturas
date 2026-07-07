import { requireUser } from '../../../../../utils/auth'
import { updateOrderItemPrice } from '../../../../../utils/orders'
import { updateOrderItemPriceSchema } from '../../../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const itemId = getRouterParam(event, 'itemId')

  if (!id || !itemId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido o de la partida.' })
  }

  const parsed = updateOrderItemPriceSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa el precio ingresado.',
      data: parsed.error.flatten()
    })
  }

  return updateOrderItemPrice(id, itemId, parsed.data, user)
})
