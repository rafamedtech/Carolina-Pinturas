import { requireUser } from '../../../utils/auth'
import { updateOrderRemision } from '../../../utils/orders'
import { updateOrderRemisionSchema } from '../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = updateOrderRemisionSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa la remisión.',
      data: parsed.error.flatten()
    })
  }

  return updateOrderRemision(id, parsed.data, user)
})
