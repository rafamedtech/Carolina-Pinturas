import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { updateOrderTags } from '../../../utils/orders'
import { updateOrderTagsSchema } from '../../../utils/order-validation'

export default eventHandler(async (event) => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }

  const parsed = updateOrderTagsSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Revisa las etiquetas.',
      data: parsed.error.flatten()
    })
  }

  return updateOrderTags(id, parsed.data, user)
})
