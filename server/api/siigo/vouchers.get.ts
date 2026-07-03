import type { SiigoInvoice, SiigoListResponse } from '~/types/siigo'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { listQuery, siigoRequest } from '../../utils/siigo'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_LOGISTICS_ROLES)
  return siigoRequest<SiigoListResponse<SiigoInvoice>>('/v1/vouchers', { query: listQuery(event) })
})
