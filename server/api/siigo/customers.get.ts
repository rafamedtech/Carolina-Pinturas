import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { cachedSiigoCatalog, collectSiigoCatalog } from '../../utils/siigo-catalog'
import { listQuery, siigoRequest } from '../../utils/siigo'

async function getAllCustomers() {
  return cachedSiigoCatalog('customers', () => collectSiigoCatalog((page, pageSize) => (
    siigoRequest<SiigoListResponse<SiigoCustomer>>('/v1/customers', {
      query: { page: String(page), page_size: String(pageSize) }
    })
  )))
}

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)

  if (getQuery(event).all === 'true') {
    return getAllCustomers()
  }

  return siigoRequest<SiigoListResponse<SiigoCustomer>>('/v1/customers', { query: listQuery(event) })
})
