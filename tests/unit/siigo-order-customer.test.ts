import { describe, expect, it, vi } from 'vitest'
import { getSiigoOrderCustomer } from '../../server/utils/siigo-order-customer'

const id = '9bf22cf2-ba6b-4030-b9a6-3286ea440b61'
const customer = { id, name: ['Cliente vigente'], active: true }

describe('cliente vigente al guardar un pedido', () => {
  it('usa el detalle cuando está disponible', async () => {
    const request = vi.fn().mockResolvedValue(customer)
    await expect(getSiigoOrderCustomer(id, request)).resolves.toMatchObject(customer)
    expect(request).toHaveBeenCalledExactlyOnceWith(`/v1/customers/${id}`)
  })

  it.each([502, 504])('consulta las páginas frescas ante un error %s del detalle', async (statusCode) => {
    const request = vi.fn()
      .mockRejectedValueOnce({ statusCode })
      .mockResolvedValueOnce({ results: [{ ...customer, id: 'otro' }], pagination: { total_results: 3, page_size: 1 } })
      .mockResolvedValueOnce({ results: [customer] })
    await expect(getSiigoOrderCustomer(id, request)).resolves.toMatchObject(customer)
    expect(request).toHaveBeenNthCalledWith(2, '/v1/customers', { query: { page: '1', page_size: '100' } })
    expect(request).toHaveBeenNthCalledWith(3, '/v1/customers', { query: { page: '2', page_size: '1' } })
    expect(request).toHaveBeenCalledTimes(3)
  })

  it.each([400, 401, 403, 404, 429])('conserva el error %s sin consultar el listado', async (statusCode) => {
    const error = { statusCode }
    const request = vi.fn().mockRejectedValue(error)
    await expect(getSiigoOrderCustomer(id, request)).rejects.toBe(error)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('conserva el error original si no encuentra el ID exacto', async () => {
    const error = { statusCode: 502 }
    const request = vi.fn().mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ results: [{ ...customer, id: 'otro' }] })
    await expect(getSiigoOrderCustomer(id, request)).rejects.toBe(error)
  })

  it('propaga errores del listado sin usar datos anteriores', async () => {
    const error = { statusCode: 401 }
    const request = vi.fn().mockRejectedValueOnce({ statusCode: 502 }).mockRejectedValueOnce(error)
    await expect(getSiigoOrderCustomer(id, request)).rejects.toBe(error)
  })

  it('rechaza un detalle con otro identificador', async () => {
    const request = vi.fn().mockResolvedValue({ ...customer, id: 'otro' })
    await expect(getSiigoOrderCustomer(id, request)).rejects.toMatchObject({ statusCode: 422 })
    expect(request).toHaveBeenCalledTimes(1)
  })
})
