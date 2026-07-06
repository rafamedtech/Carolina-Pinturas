import { describe, expect, it } from 'vitest'
import type { SiigoCustomer, SiigoListResponse } from '../../app/types/siigo'
import { addCustomerToCatalog } from '../../app/utils/customerCatalog'

const nuevo: SiigoCustomer = { id: 'nuevo-id', name: ['María', 'López'] }
const existente: SiigoCustomer = { id: 'existente-id', name: ['Pinturas SA'] }

describe('addCustomerToCatalog', () => {
  it('crea el catálogo cuando aún no existe', () => {
    expect(addCustomerToCatalog(null, nuevo)).toEqual({
      results: [nuevo],
      pagination: { total_results: 1, page: 1, page_size: 1 }
    })
  })

  it('agrega el cliente al inicio y ajusta total_results', () => {
    const catalog: SiigoListResponse<SiigoCustomer> = {
      results: [existente],
      pagination: { total_results: 1, page: 1, page_size: 25 }
    }

    const updated = addCustomerToCatalog(catalog, nuevo)

    expect(updated.results.map(customer => customer.id)).toEqual(['nuevo-id', 'existente-id'])
    expect(updated.pagination?.total_results).toBe(2)
  })

  it('tolera catálogos sin paginación', () => {
    const updated = addCustomerToCatalog({ results: [existente] }, nuevo)
    expect(updated.results).toHaveLength(2)
    expect(updated.pagination).toBeUndefined()
  })
})
