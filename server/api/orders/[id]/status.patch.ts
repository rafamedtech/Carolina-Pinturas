import { requireUser } from '../../../utils/auth'
import { updateOrderStatus } from '../../../utils/orders'
import { updateOrderStatusSchema } from '../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = updateOrderStatusSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa el nuevo estado.',
      data: parsed.error.flatten()
    })
  }

  return updateOrderStatus(id, parsed.data, user)
})
