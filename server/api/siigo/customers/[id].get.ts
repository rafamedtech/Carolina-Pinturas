import type { SiigoCustomer } from '~/types/siigo'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { siigoRequest } from '../../../utils/siigo'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del cliente.' })
  }

  return siigoRequest<SiigoCustomer>(`/v1/customers/${encodeURIComponent(id)}`)
})
