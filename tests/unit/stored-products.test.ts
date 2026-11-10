import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { productQuerySchema } from '../../shared/schemas/product'
import { getStoredProduct, getStoredProducts, listStoredProducts, storedProductView } from '../../server/utils/stored-products'

const remote = vi.hoisted(() => vi.fn(() => {
  throw new Error('No se debe consultar Siigo')
}))
vi.mock('../../server/utils/siigo', () => ({ siigoRequest: remote }))
const findMany = vi.fn()
const findUnique = vi.fn()
const aggregate = vi.fn()
let db: Parameters<typeof getStoredProducts>[0]
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
  db = { siigoProduct: { findMany, findUnique, aggregate } } as unknown as typeof db
  aggregate.mockResolvedValue({ _count: { _all: 2 }, _max: { updatedAt: new Date('2026-11-09T00:00:00Z') } })
  findMany.mockResolvedValue([row(), row('archived', false)])
  findUnique.mockResolvedValue(row())
})
afterEach(() => vi.useRealTimers())

describe('catálogo de productos persistido', () => {
  it('comparte la carga concurrente y revisa cambios sin volver a descargar el catálogo', async () => {
    const [first, second] = await Promise.all([getStoredProducts(db), getStoredProducts(db)])
    first[0]!.prices![0]!.price_list![0]!.value = 999
    expect(second[0]!.prices![0]!.price_list![0]!.value).toBe(108)
    expect((await getStoredProducts(db))[0]!.prices![0]!.price_list![0]!.value).toBe(108)
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(aggregate).toHaveBeenCalledTimes(3)
  })
  it('invalida al detectar escrituras de otra instancia o eliminaciones', async () => {
    await getStoredProducts(db)
    aggregate.mockResolvedValue({ _count: { _all: 2 }, _max: { updatedAt: new Date('2026-11-09T00:01:00Z') } })
    findMany.mockResolvedValue([row('changed')])
    expect((await getStoredProducts(db))[0]!.id).toBe('changed')
    aggregate.mockResolvedValue({ _count: { _all: 0 }, _max: { updatedAt: null } })
    findMany.mockResolvedValue([])
    expect(await getStoredProducts(db)).toEqual([])
    expect(findMany).toHaveBeenCalledTimes(3)
  })
  it('limita la vida de la caché y no conserva errores de lectura', async () => {
    vi.useFakeTimers()
    await getStoredProducts(db)
    vi.advanceTimersByTime(60_001)
    findMany.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(getStoredProducts(db)).rejects.toThrow('database unavailable')
    await expect(getStoredProducts(db)).resolves.toHaveLength(2)
    expect(findMany).toHaveBeenCalledTimes(3)
  })
  it('las lecturas por ID siempre consultan PostgreSQL y no usan la caché', async () => {
    await getStoredProducts(db)
    await getStoredProducts(db, ['product-1'])
    await getStoredProducts(db, ['product-1'])
    expect(findMany).toHaveBeenCalledTimes(3)
    expect(aggregate).toHaveBeenCalledTimes(1)
  })
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
