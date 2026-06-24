import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'
import { requireUser } from '../../utils/auth'
import { listQuery, siigoRequest } from '../../utils/siigo'

const siigoPageSize = 25

async function getAllCustomers() {
  const firstPage = await siigoRequest<SiigoListResponse<SiigoCustomer>>('/v1/customers', {
    query: { page: '1', page_size: String(siigoPageSize) }
  })
  const allCustomers = [...firstPage.results]
  const totalInSiigo = firstPage.pagination?.total_results || allCustomers.length
  const totalPages = Math.ceil(totalInSiigo / siigoPageSize)

  for (let sourcePage = 2; sourcePage <= totalPages; sourcePage++) {
    const response = await siigoRequest<SiigoListResponse<SiigoCustomer>>('/v1/customers', {
      query: { page: String(sourcePage), page_size: String(siigoPageSize) }
    })
    allCustomers.push(...response.results)
  }

  return {
    results: allCustomers,
    pagination: {
      total_results: allCustomers.length,
      page: 1,
      page_size: allCustomers.length
    }
  }
}

export default eventHandler(async (event) => {
  requireUser(event)

  if (getQuery(event).all === 'true') {
    return getAllCustomers()
  }

  return siigoRequest<SiigoListResponse<SiigoCustomer>>('/v1/customers', { query: listQuery(event) })
})
