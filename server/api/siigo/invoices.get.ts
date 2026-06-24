import type { SiigoInvoice, SiigoListResponse } from '~/types/siigo'
import { requireUser } from '../../utils/auth'
import { listQuery, siigoRequest } from '../../utils/siigo'

export default eventHandler((event) => {
  requireUser(event)
  return siigoRequest<SiigoListResponse<SiigoInvoice>>('/v1/invoices', { query: listQuery(event) })
})
