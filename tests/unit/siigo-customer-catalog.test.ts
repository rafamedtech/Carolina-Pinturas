import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSiigoCustomerPage, getAllSiigoCustomers } from '../../server/utils/siigo-customer-catalog'
import { clearSiigoCatalogCache, invalidateSiigoCatalog } from '../../server/utils/siigo-catalog'
import { siigoRequest } from '../../server/utils/siigo'

vi.mock('../../server/utils/siigo', () => ({ siigoRequest: vi.fn() }))

// Respuestas mínimas observadas en lecturas reales el 2026-09-08.
const universal = {
  id: '8f8bcddc-56f0-4f6d-b056-08fc4e679e93',
  name: [null],
  rfc_id: 'UPN111005456',
  type: 'Supplier',
  active: true
}
const detail = { ...universal, name: ['UNIVERSAL PAINT DEL NOROESTE, S. DE R.L. DE C.V.'] }
const query = { page: '1', page_size: '100' }
const pagination = { page: 1, page_size: 100, total_results: 1 }

describe('nombres omitidos en el listado de Siigo México', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearSiigoCatalogCache()
  })

  it('recupera la razón social por ID antes de sustituirla por el RFC', async () => {
    vi.mocked(siigoRequest).mockResolvedValueOnce({ results: [universal], pagination })
      .mockResolvedValueOnce(detail)

    const result = await fetchSiigoCustomerPage(query)

    expect(result.results[0]).toMatchObject(detail)
    expect(result.pagination).toEqual(pagination)
    expect(siigoRequest).toHaveBeenNthCalledWith(1, '/v1/customers', { query })
    expect(siigoRequest).toHaveBeenNthCalledWith(2, `/v1/customers/${universal.id}`)
    expect(result.results[0]?.name.join(' ').toLowerCase()).toContain('universal paint')
  })

  it('no consulta detalle de nombres válidos y conserva el orden', async () => {
    const named = { id: 'otro', name: 'Nombre disponible' }
    vi.mocked(siigoRequest).mockResolvedValueOnce({ results: [named, universal], pagination })
      .mockResolvedValueOnce(detail)

    const result = await fetchSiigoCustomerPage(query)

    expect(result.results.map(row => row.name)).toEqual([['Nombre disponible'], detail.name])
    expect(siigoRequest).toHaveBeenCalledTimes(2)
  })

  it('deduplica detalles repetidos y codifica el identificador externo', async () => {
    const raw = { ...universal, id: 'id/con espacios' }
    vi.mocked(siigoRequest).mockResolvedValueOnce({ results: [raw, raw] })
      .mockResolvedValueOnce({ ...detail, id: raw.id })

    expect((await fetchSiigoCustomerPage(query)).results).toHaveLength(2)
    expect(siigoRequest).toHaveBeenLastCalledWith('/v1/customers/id%2Fcon%20espacios')
    expect(siigoRequest).toHaveBeenCalledTimes(2)
  })

  it('rechaza un detalle de otro tercero sin exponer su contenido', async () => {
    vi.mocked(siigoRequest).mockResolvedValueOnce({ results: [universal] })
      .mockResolvedValueOnce({ ...detail, id: 'otro-id' })

    await expect(fetchSiigoCustomerPage(query)).rejects.toMatchObject({ statusCode: 502 })
  })

  it('conserva el respaldo por RFC si Siigo tampoco tiene nombre en el detalle', async () => {
    vi.mocked(siigoRequest).mockResolvedValueOnce({ results: [universal], pagination })
      .mockResolvedValueOnce(universal)

    const result = await fetchSiigoCustomerPage(query)
    expect(result.results[0]?.name).toEqual([universal.rfc_id])
    expect(result.results[0]?.id).toBe(universal.id)
  })

  it.each([401, 429, 504])('propaga el error %s del detalle sin publicar un catálogo incompleto', async (statusCode) => {
    vi.mocked(siigoRequest).mockResolvedValueOnce({ results: [universal] })
      .mockRejectedValueOnce({ statusCode })

    await expect(fetchSiigoCustomerPage(query)).rejects.toEqual({ statusCode })
  })

  it('cachea los nombres recuperados y Recargar vuelve a consultar su versión vigente', async () => {
    vi.mocked(siigoRequest).mockImplementation(async path => (
      path === '/v1/customers' ? { results: [universal], pagination } : detail
    ))

    const [first, concurrent] = await Promise.all([getAllSiigoCustomers(), getAllSiigoCustomers()])
    expect(first.results[0]?.name).toEqual(detail.name)
    expect(concurrent).toEqual(first)
    expect(await getAllSiigoCustomers()).toEqual(first)
    expect(siigoRequest).toHaveBeenCalledTimes(2)

    invalidateSiigoCatalog('customers')
    await getAllSiigoCustomers()
    expect(siigoRequest).toHaveBeenCalledTimes(4)
  })
})
