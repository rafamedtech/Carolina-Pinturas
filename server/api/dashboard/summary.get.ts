import type { SiigoListResponse } from '~/types/siigo'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'
import { siigoRequest } from '../../utils/siigo'

function total(response: SiigoListResponse<unknown>) {
  return response.pagination?.total_results ?? response.results.length
}

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_LOGISTICS_ROLES)
  const prisma = usePrisma()

  const [orders, delivered, products, customers] = await Promise.all([
    prisma.salesOrder.count(),
    prisma.salesOrder.count({ where: { statusKey: 'entregado' } }),
    siigoRequest<SiigoListResponse<unknown>>('/v1/products', {
      query: { page: '1', page_size: '1' }
    }).then(total).catch(() => null),
    siigoRequest<SiigoListResponse<unknown>>('/v1/customers', {
      query: { page: '1', page_size: '1' }
    }).then(total).catch(() => null)
  ])

  return {
    products,
    customers,
    orders,
    delivered,
    siigoAvailable: products !== null && customers !== null
  }
})
