import { createError } from 'h3'
import type { SiigoListResponse } from '~/types/siigo'
import { SIIGO_FULL_CATALOG_PAGE_SIZE } from './siigo-catalog'
import { normalizeSiigoCustomer, type SiigoCustomerApiResponse } from './siigo-customers'
import { siigoRequest } from './siigo'

// Siigo México devolvió 500 para el detalle de un cliente existente el
// 27/10/2026. El listado permite consultar el mismo tercero sin usar snapshots
// locales ni datos enviados por el navegador para guardar el pedido.
export async function getSiigoOrderCustomer(customerId: string, request = siigoRequest) {
  try {
    const response = await request<SiigoCustomerApiResponse>(`/v1/customers/${encodeURIComponent(customerId)}`)
    if (response.id !== customerId) {
      throw createError({ statusCode: 422, statusMessage: 'Siigo devolvió un cliente distinto al seleccionado.' })
    }
    return normalizeSiigoCustomer(response)
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode
    if (status !== 502 && status !== 504) throw error

    // Consulta fresca y secuencial, sin el respaldo de caché del catálogo.
    const pageSize = SIIGO_FULL_CATALOG_PAGE_SIZE
    let totalPages = 1
    let effectivePageSize = pageSize
    for (let page = 1; page <= totalPages; page++) {
      const response = await request<SiigoListResponse<SiigoCustomerApiResponse>>('/v1/customers', {
        query: { page: String(page), page_size: String(effectivePageSize) }
      })
      const customer = response.results.find(candidate => candidate.id === customerId)
      if (customer) return normalizeSiigoCustomer(customer)
      if (page === 1) {
        effectivePageSize = response.pagination?.page_size || pageSize
        totalPages = Math.max(1, Math.ceil((response.pagination?.total_results ?? response.results.length) / effectivePageSize))
      }
    }
    throw error
  }
}
