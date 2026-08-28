import type { SiigoListResponse } from '~/types/siigo'
import { cachedSiigoCatalog, collectSiigoCatalog } from './siigo-catalog'
import {
  normalizeSiigoCustomerList,
  type SiigoCustomerApiResponse
} from './siigo-customers'
import { siigoRequest } from './siigo'

export async function fetchSiigoCustomerPage(query: Record<string, string | undefined>) {
  const response = await siigoRequest<SiigoListResponse<SiigoCustomerApiResponse>>(
    '/v1/customers',
    { query }
  )

  return normalizeSiigoCustomerList(response)
}

export function getAllSiigoCustomers() {
  return cachedSiigoCatalog('customers', () => collectSiigoCatalog((page, pageSize) => (
    fetchSiigoCustomerPage({ page: String(page), page_size: String(pageSize) })
  )))
}
