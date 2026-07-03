import type { SiigoListResponse, SiigoProduct } from '~/types/siigo'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { listQuery, siigoRequest } from '../../utils/siigo'

const siigoPageSize = 25

async function getAllProducts() {
  const firstPage = await siigoRequest<SiigoListResponse<SiigoProduct>>('/v1/products', {
    query: { page: '1', page_size: String(siigoPageSize) }
  })
  const allProducts = [...firstPage.results]
  const totalInSiigo = firstPage.pagination?.total_results || allProducts.length
  const totalPages = Math.ceil(totalInSiigo / siigoPageSize)

  for (let sourcePage = 2; sourcePage <= totalPages; sourcePage++) {
    const response = await siigoRequest<SiigoListResponse<SiigoProduct>>('/v1/products', {
      query: { page: String(sourcePage), page_size: String(siigoPageSize) }
    })
    allProducts.push(...response.results)
  }

  return {
    results: allProducts,
    pagination: {
      total_results: allProducts.length,
      page: 1,
      page_size: allProducts.length
    }
  }
}

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const query = getQuery(event)

  if (query.all === 'true') {
    return getAllProducts()
  }

  return siigoRequest<SiigoListResponse<SiigoProduct>>('/v1/products', { query: listQuery(event) })
})
