import type { SiigoInvoice, SiigoListResponse } from '~/types/siigo'
import { requireUser } from '../../utils/auth'
import { listQuery, siigoRequest } from '../../utils/siigo'

export default eventHandler(async (event) => {
  await requireUser(event)
  return siigoRequest<SiigoListResponse<SiigoInvoice>>('/v1/vouchers', { query: listQuery(event) })
})
