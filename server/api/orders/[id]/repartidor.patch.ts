import { requireUser } from '../../../utils/auth'
import { updateOrderRepartidor } from '../../../utils/orders'
import { updateOrderRepartidorSchema } from '../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = updateOrderRepartidorSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa el repartidor.',
      data: parsed.error.flatten()
    })
  }

  return updateOrderRepartidor(id, parsed.data, user)
})
