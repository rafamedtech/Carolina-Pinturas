import type { SiigoListResponse } from '~/types/siigo'
import { requireUser } from '../../utils/auth'
import { siigoRequest } from '../../utils/siigo'

interface CountableResponse {
  results?: unknown[]
  pagination?: { total_results?: number }
}

function total(response: CountableResponse) {
  return response.pagination?.total_results ?? response.results?.length ?? 0
}

export default eventHandler(async (event) => {
  requireUser(event)

  const [products, customers, invoices, vouchers] = await Promise.all([
    siigoRequest<SiigoListResponse<unknown>>('/v1/products'),
    siigoRequest<SiigoListResponse<unknown>>('/v1/customers'),
    siigoRequest<SiigoListResponse<unknown>>('/v1/invoices'),
    siigoRequest<SiigoListResponse<unknown>>('/v1/vouchers')
  ])

  return {
    products: total(products),
    customers: total(customers),
    invoices: total(invoices),
    vouchers: total(vouchers)
  }
})
