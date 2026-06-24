import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'
import { requireUser } from '../../utils/auth'
import { listQuery, siigoRequest } from '../../utils/siigo'

export default eventHandler((event) => {
  requireUser(event)
  return siigoRequest<SiigoListResponse<SiigoCustomer>>('/v1/customers', { query: listQuery(event) })
})
