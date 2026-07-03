import { requireUser } from '../../utils/auth'
import { getRepartidorWithDeliveries } from '../../utils/repartidores'

export default eventHandler(async (event) => {
  await requireUser(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del repartidor.' })
  }

  return getRepartidorWithDeliveries(id)
})
