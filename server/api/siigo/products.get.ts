import type { SiigoListResponse, SiigoProduct } from '~/types/siigo'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { cachedSiigoCatalog, collectSiigoCatalog } from '../../utils/siigo-catalog'
import { listQuery, siigoRequest } from '../../utils/siigo'

const activeProductsQuery = { active: 'true' }

async function getAllProducts() {
  return cachedSiigoCatalog('active-products', () => collectSiigoCatalog((page, pageSize) => (
    siigoRequest<SiigoListResponse<SiigoProduct>>('/v1/products', {
      query: { ...activeProductsQuery, page: String(page), page_size: String(pageSize) }
    })
  )))
}

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const query = getQuery(event)

  if (query.all === 'true') {
    return getAllProducts()
  }

  return siigoRequest<SiigoListResponse<SiigoProduct>>('/v1/products', {
    query: { ...listQuery(event), ...activeProductsQuery }
  })
})
