import { requireUser } from '../../../../../utils/auth'
import { updateOrderItemObservations } from '../../../../../utils/orders'
import { updateOrderItemObservationsSchema } from '../../../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const itemId = getRouterParam(event, 'itemId')

  if (!id || !itemId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido o de la partida.' })
  }

  const parsed = updateOrderItemObservationsSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa las observaciones ingresadas.',
      data: parsed.error.flatten()
    })
  }

  return updateOrderItemObservations(id, itemId, parsed.data, user)
})
