import type { SiigoListResponse } from '~/types/siigo'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { cachedSiigoCatalog, collectSiigoCatalog } from '../../utils/siigo-catalog'
import { listQuery, siigoRequest } from '../../utils/siigo'
import {
  normalizeSiigoCustomerList,
  type SiigoCustomerApiResponse
} from '../../utils/siigo-customers'

async function getCustomersPage(query: Record<string, string | undefined>) {
  const response = await siigoRequest<SiigoListResponse<SiigoCustomerApiResponse>>('/v1/customers', { query })
  return normalizeSiigoCustomerList(response)
}

async function getAllCustomers() {
  return cachedSiigoCatalog('customers', () => collectSiigoCatalog((page, pageSize) => (
    getCustomersPage({ page: String(page), page_size: String(pageSize) })
  )))
}

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)

  if (getQuery(event).all === 'true') {
    return getAllCustomers()
  }

  return getCustomersPage(listQuery(event))
})
