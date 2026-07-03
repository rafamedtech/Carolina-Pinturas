import type { SiigoCustomer } from '~/types/siigo'
import { requireUser } from '../../../utils/auth'
import { siigoRequest } from '../../../utils/siigo'

export default eventHandler(async (event) => {
  await requireUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del cliente.' })
  }

  return siigoRequest<SiigoCustomer>(`/v1/customers/${encodeURIComponent(id)}`)
})
