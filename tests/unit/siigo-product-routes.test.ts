import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { productMutationInput } from '../../app/utils/siigoProductMutation'

const mocks = vi.hoisted(() => ({ role: 'admin', mutate: vi.fn(), list: vi.fn(), detail: vi.fn(), context: vi.fn(), sat: vi.fn(), image: vi.fn(), saveImage: vi.fn(), deleteImage: vi.fn(), localList: vi.fn(), localDetail: vi.fn(), persist: vi.fn(), persistDetail: vi.fn(), archiveMissing: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({
  requireRole: async (_event: unknown, roles: readonly string[]) => {
    if (!roles.includes(mocks.role)) throw createError({ statusCode: 403 })
    return { role: mocks.role }
  }
}))
vi.mock('../../server/utils/siigo-products', () => ({ mutateProduct: mocks.mutate, listProducts: mocks.list, getProductDetail: mocks.detail, getProductContext: mocks.context }))
vi.mock('../../server/utils/managed-products', () => ({ saveManagedProduct: mocks.mutate, recoverProductWrite: vi.fn() }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ siigoProduct: { updateMany: mocks.archiveMissing } }) }))
vi.mock('../../server/utils/stored-products', () => ({ listStoredProducts: mocks.localList, getStoredProduct: mocks.localDetail }))
vi.mock('../../server/utils/siigo-persistence', () => ({ upsertSiigoProduct: mocks.persistDetail }))
vi.mock('../../server/utils/product-catalog-persistence', () => ({ persistProductCatalog: mocks.persist }))
vi.mock('../../server/utils/product-compositions', () => ({ attachProductCompositions: async (_db: unknown, products: unknown[]) => products }))
vi.mock('../../server/utils/siigo-product-sat', () => ({ getProductSatCatalog: mocks.sat, searchProductSat: vi.fn() }))
vi.mock('../../server/utils/product-images', () => ({ getProductImage: mocks.image, saveProductImage: mocks.saveImage, deleteProductImage: mocks.deleteImage }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('getQuery', (event: { query: unknown }) => event.query || {})
vi.stubGlobal('getRouterParam', (event: { id: string }) => event.id)
vi.stubGlobal('setResponseStatus', vi.fn())
vi.stubGlobal('readMultipartFormData', async (event: { parts?: unknown }) => event.parts)
const create = (await import('../../server/api/siigo/products/index.post')).default
const update = (await import('../../server/api/siigo/products/[id].put')).default
const active = (await import('../../server/api/siigo/products/[id]/active.patch')).default
const recover = (await import('../../server/api/siigo/products/recover.post')).default
const list = (await import('../../server/api/siigo/products.get')).default
const detail = (await import('../../server/api/siigo/products/[id].get')).default
const context = (await import('../../server/api/siigo/products/context.get')).default
const sat = (await import('../../server/api/siigo/products/sat/index.get')).default
const uploadImage = (await import('../../server/api/siigo/products/[id]/image.put')).default
const removeImage = (await import('../../server/api/siigo/products/[id]/image.delete')).default
const id = '00000000-0000-4000-8000-000000000001'
const body = { ...productMutationInput(), code: 'PIN1', name: 'Pintura', account_group: 10, key: '31211500', unit: 'H87' }
// Route wrappers are deliberately invoked with a minimal event and mocked H3 I/O.
const event = (data: object) => data as Parameters<typeof create>[0]
beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'admin'
  mocks.mutate.mockResolvedValue({ id, ...body })
  mocks.list.mockResolvedValue({ results: [] })
  mocks.localList.mockResolvedValue([])
  mocks.localDetail.mockResolvedValue({ id, ...body, account_group: { id: 10 }, key: { code: '31211500' }, unit: { code: 'H87' } })
  mocks.detail.mockResolvedValue({ id, ...body, account_group: { id: 10 }, key: { code: '31211500' }, unit: { code: 'H87' } })
})

describe('autorización y frontera HTTP de productos', () => {
  it('excluye combos y servicios de nuevas ventas sin perder el catálogo histórico', async () => {
    mocks.localList.mockResolvedValue([{ id, type: 'Product' }, { id: 'combo', type: 'Combo' }, { id: 'service', type: 'Service' }, { id: 'pending', type: 'Product', internal: { syncPending: true } }, { id: 'composite', type: 'Product', internal: { composition: { kind: 'composite' } } }])
    const saleCatalog = await list(event({ query: { all: 'true', products_only: 'true' } }))
    expect(saleCatalog.results.map(p => p.id)).toEqual([id, 'composite'])
    const purchaseCatalog = await list(event({ query: { all: 'true', simple_only: 'true' } }))
    expect(purchaseCatalog.results.map(p => p.id)).toEqual([id])
    const history = await list(event({ query: { active: 'all' } }))
    expect(history.results).toHaveLength(5)
  })
  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'])('rechaza escritura y catálogos de edición para %s', async (role) => {
    mocks.role = role
    for (const route of [create, update, active, recover, context, sat, uploadImage, removeImage]) {
      await expect(route(event({ id, body, query: { kind: 'unit' } }))).rejects.toMatchObject({ statusCode: 403 })
    }
    expect(mocks.saveImage).not.toHaveBeenCalled()
    expect(mocks.deleteImage).not.toHaveBeenCalled()
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it.each(['admin', 'mostrador', 'vendedor', 'repartidor'])('conserva consulta para %s', async (role) => {
    mocks.role = role
    await list(event({ query: {} }))
    await detail(event({ id, query: {} }))
    expect(mocks.localList).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ active: 'true' }))
    expect(mocks.list).not.toHaveBeenCalled()
    expect(mocks.localDetail).toHaveBeenCalledWith(expect.anything(), id)
    expect(mocks.detail).not.toHaveBeenCalled()
  })
  it('solo Actualizar sincroniza todo el catálogo, incluidos inactivos, y luego responde desde PostgreSQL', async () => {
    mocks.list.mockResolvedValue({ results: [{ id, code: 'REMOTO', name: 'Remoto' }] })
    mocks.localList.mockResolvedValue([{ id, code: 'LOCAL', name: 'Local' }])
    const result = await list(event({ query: { all: 'true', active: 'false', refresh: 'true' } }))
    expect(mocks.list).toHaveBeenCalledWith({ all: 'true', refresh: 'true', active: 'all', page: 1, page_size: 100 })
    expect(mocks.persist).toHaveBeenCalledWith(expect.anything(), [{ id, code: 'REMOTO', name: 'Remoto' }])
    expect(result.results[0]?.code).toBe('LOCAL')
    expect(mocks.archiveMissing).toHaveBeenCalledWith(expect.objectContaining({ data: { active: false } }))
  })
  it('no oculta fallos de sincronización ni desactiva productos después de un fallo de Siigo', async () => {
    mocks.list.mockRejectedValueOnce(createError({ statusCode: 502 }))
    await expect(list(event({ query: { refresh: 'true' } }))).rejects.toMatchObject({ statusCode: 502 })
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.archiveMissing).not.toHaveBeenCalled()
  })
  it('admin puede crear, editar y activar', async () => {
    await create(event({ body }))
    await update(event({ id, body }))
    await active(event({ id, body: { active: false } }))
    expect(mocks.mutate.mock.calls).toEqual([[body], [body, id], [{ ...body, active: false, availability: { purchase: false, sale: false, expense: false } }, id]])
  })
  it('desactivar desde la acción superior desmarca las tres disponibilidades', async () => {
    mocks.detail.mockResolvedValue({
      id, ...body, account_group: { id: 10 }, key: { code: '31211500' }, unit: { code: 'H87' },
      internal: { availability: { purchase: true, sale: true, expense: true } }
    })
    await active(event({ id, body: { active: false } }))
    expect(mocks.mutate).toHaveBeenCalledWith({
      ...body, active: false, availability: { purchase: false, sale: false, expense: false }
    }, id)
  })
  it('activar conserva las disponibilidades configuradas', async () => {
    const availability = { purchase: false, sale: true, expense: true }
    mocks.detail.mockResolvedValue({
      id, ...body, active: false, account_group: { id: 10 }, key: { code: '31211500' }, unit: { code: 'H87' },
      internal: { availability }
    })
    await active(event({ id, body: { active: true } }))
    expect(mocks.mutate).toHaveBeenCalledWith({ ...body, active: true, availability }, id)
  })
  it('rechaza UUID, entrada y filtros inválidos antes de Siigo', async () => {
    await expect(update(event({ id: '../../auth', body }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(create(event({ body: {} }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(recover(event({ body: { operationId: '../auth' } }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(active(event({ id, body: { active: false, prices: [] } }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(list(event({ query: { ids: Array(21).fill(id).join(',') } }))).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it('refresh de detalle fuerza lectura fresca', async () => {
    await detail(event({ id, query: { refresh: 'true' } }))
    expect(mocks.detail).toHaveBeenCalledWith(id, true)
    expect(mocks.persistDetail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id }))
  })
})

describe('imágenes de producto', () => {
  const image = { url: 'https://example.supabase.co/storage/v1/object/public/product-images/a.png', updatedAt: '2026-09-15T00:00:00.000Z' }
  it('detalle agrega la imagen local sin mezclarla con Siigo', async () => {
    mocks.localDetail.mockResolvedValue({ id, code: 'PIN1', name: 'Pintura' })
    mocks.image.mockResolvedValue(image)
    await expect(detail(event({ id, query: {} }))).resolves.toEqual({ id, code: 'PIN1', name: 'Pintura', internal: { image } })
  })
  it('admin sube solo el archivo del campo image', async () => {
    const data = new Uint8Array([1, 2, 3])
    await uploadImage(event({ id, parts: [{ name: 'otro', filename: 'x.png', data: new Uint8Array([9]) }, { name: 'image', filename: 'foto.png', data }] }))
    expect(mocks.saveImage).toHaveBeenCalledWith(expect.anything(), id, data, { role: 'admin' })
  })
  it('admin elimina la imagen y rechaza UUID inválido', async () => {
    await removeImage(event({ id }))
    expect(mocks.deleteImage).toHaveBeenCalledWith(expect.anything(), id)
    await expect(uploadImage(event({ id: '../x', parts: [] }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(removeImage(event({ id: '../x' }))).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('disponibilidad interna del catálogo', () => {
  it.each(['purchase', 'sale', 'expense'] as const)('filtra %s antes de paginar y conserva el catálogo administrativo', async (usage) => {
    const rows = [
      { id, code: 'BASE', name: 'Base', type: 'Product', internal: { availability: { purchase: true, sale: false, expense: false } } },
      { id: '00000000-0000-4000-8000-000000000002', code: 'KIT', name: 'Kit', type: 'Product', internal: { availability: { purchase: false, sale: true, expense: true }, composition: { kind: 'composite' } } }
    ]
    mocks.localList.mockResolvedValue(rows)
    const result = await list(event({ query: { usage, page_size: '1' } }))
    expect(result.results.map(p => p.code)).toEqual([usage === 'purchase' ? 'BASE' : 'KIT'])
    expect(result.pagination?.total_results).toBe(1)
    expect((await list(event({ query: { all: 'true' } }))).results).toHaveLength(2)
  })
  it('compra excluye compuestos incluso con disponibilidad habilitada', async () => {
    mocks.localList.mockResolvedValue([{ id, type: 'Product', internal: { availability: { purchase: true }, composition: { kind: 'composite' } } }])
    expect((await list(event({ query: { usage: 'purchase' } }))).results).toEqual([])
    await expect(list(event({ query: { usage: 'inventado' } }))).rejects.toMatchObject({ statusCode: 400 })
  })
})
