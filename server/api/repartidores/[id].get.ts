import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { getRepartidorWithDeliveries } from '../../utils/repartidores'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del repartidor.' })
  }

  return getRepartidorWithDeliveries(id)
})
