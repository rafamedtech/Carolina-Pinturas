import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { getSiigoCustomerDetail } from '../../../utils/siigo-customer-detail'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del cliente.' })
  }

  return getSiigoCustomerDetail(id)
})
