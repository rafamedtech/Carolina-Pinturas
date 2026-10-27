import type { SiigoListResponse } from '~/types/siigo'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'
import { siigoRequest } from '../../utils/siigo'

interface CountableResponse {
  results?: unknown[]
  pagination?: { total_results?: number }
}

function total(response: CountableResponse) {
  return response.pagination?.total_results ?? response.results?.length ?? 0
}

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_LOGISTICS_ROLES)

  const [products, customers, invoices, vouchers] = await Promise.all([
    usePrisma().siigoProduct.count(),
    siigoRequest<SiigoListResponse<unknown>>('/v1/customers'),
    siigoRequest<SiigoListResponse<unknown>>('/v1/invoices'),
    siigoRequest<SiigoListResponse<unknown>>('/v1/vouchers')
  ])

  return {
    products,
    customers: total(customers),
    invoices: total(invoices),
    vouchers: total(vouchers)
  }
})
