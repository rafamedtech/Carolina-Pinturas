import { beforeEach, describe, expect, it, vi } from 'vitest'
import { productQuerySchema } from '../../shared/schemas/product'
import { getStoredProduct, getStoredProducts, listStoredProducts, storedProductView } from '../../server/utils/stored-products'

const remote = vi.hoisted(() => vi.fn(() => {
  throw new Error('No se debe consultar Siigo')
}))
vi.mock('../../server/utils/siigo', () => ({ siigoRequest: remote }))
const findMany = vi.fn()
const findUnique = vi.fn()
const db = { siigoProduct: { findMany, findUnique } } as unknown as Parameters<typeof getStoredProducts>[0]
function row(id = 'product-1', active = true) {
  return {
    id, code: id, name: 'Pintura guardada', type: 'Product', active, unitCode: 'H87', unitName: 'Pieza',
    rawPayload: { id, code: 'anterior', name: 'Nombre anterior', type: 'Product', unit: {}, active: true,
      prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 108 }] }],
      taxes: [{ id: 5, percentage: 8 }], metadata: { created: '2026-09-01T12:00:00Z' } }
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  findMany.mockResolvedValue([row(), row('archived', false)])
  findUnique.mockResolvedValue(row())
})

describe('catálogo de productos persistido', () => {
  it('lista y filtra por estado y fecha sin ninguna conexión con Siigo', async () => {
    const products = await listStoredProducts(db, productQuerySchema.parse({ created_start: '2026-09-01' }))
    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({ code: 'product-1', name: 'Pintura guardada', unit: { code: 'H87', name: 'Pieza' }, taxes: [{ percentage: 8 }], prices: [{ price_list: [{ value: 108 }] }] })
    expect(await listStoredProducts(db, productQuerySchema.parse({ created_start: '2026-09-02' }))).toEqual([])
    expect(remote).not.toHaveBeenCalled()
  })
  it('preserva la unidad conocida aunque el último listado de Siigo tenga una unidad vacía', () => {
    expect(storedProductView(row()).unit).toEqual({ code: 'H87', name: 'Pieza' })
  })
  it('consulta productos de pedidos en un solo lote y no consulta con IDs vacíos', async () => {
    await getStoredProducts(db, ['product-1', 'product-1'])
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['product-1'] } } }))
    expect(await getStoredProducts(db, [])).toEqual([])
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(remote).not.toHaveBeenCalled()
  })
  it('devuelve el detalle local y un 404 sin intentar una sincronización implícita', async () => {
    await expect(getStoredProduct(db, 'product-1')).resolves.toMatchObject({ id: 'product-1' })
    findUnique.mockResolvedValue(null)
    await expect(getStoredProduct(db, 'missing')).rejects.toMatchObject({ statusCode: 404 })
    expect(remote).not.toHaveBeenCalled()
  })
})
