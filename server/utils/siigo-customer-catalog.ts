import { createError } from 'h3'
import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'
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

  const results: SiigoCustomerApiResponse[] = []
  const details = new Map<string, SiigoCustomerApiResponse>()
  for (const raw of response.results) {
    if (hasCustomerName(raw.name) || typeof raw.id !== 'string' || !raw.id.trim()) {
      results.push(raw)
      continue
    }

    // Confirmado contra Siigo México el 2026-09-08: UNIVERSAL PAINT llega
    // con name: [null] en el listado, pero el detalle trae su razón social.
    // Consultar sólo los nombres ausentes, en serie y dentro de la caché del
    // catálogo; usar el RFC como nombre ocultaba estos terceros al buscarlos.
    let detail = details.get(raw.id)
    if (!detail) {
      detail = await siigoRequest<SiigoCustomerApiResponse>(
        `/v1/customers/${encodeURIComponent(raw.id)}`
      )
      if (detail.id !== raw.id) {
        throw createError({
          statusCode: 502,
          statusMessage: 'Siigo devolvió un identificador distinto al consultar un tercero del catálogo.'
        })
      }
      details.set(raw.id, detail)
    }
    // Algunos terceros tampoco tienen nombre en el detalle. En ese caso se
    // conserva el respaldo comercial/RFC del normalizador sin ocultar la fila.
    results.push(hasCustomerName(detail.name) ? { ...raw, name: detail.name } : raw)
  }

  return normalizeSiigoCustomerList({ ...response, results })
}

function hasCustomerName(name: unknown): name is SiigoCustomer['name'] | string {
  return (Array.isArray(name) ? name : [name])
    .some(part => typeof part === 'string' && part.trim())
}

export function getAllSiigoCustomers() {
  return cachedSiigoCatalog('customers', () => collectSiigoCatalog((page, pageSize) => (
    fetchSiigoCustomerPage({ page: String(page), page_size: String(pageSize) })
  )))
}
