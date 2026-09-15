import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { productMutationInput } from '../../app/utils/siigoProductMutation'

const mocks = vi.hoisted(() => ({ role: 'admin', mutate: vi.fn(), list: vi.fn(), detail: vi.fn(), context: vi.fn(), sat: vi.fn(), image: vi.fn(), saveImage: vi.fn(), deleteImage: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({
  requireRole: async (_event: unknown, roles: readonly string[]) => {
    if (!roles.includes(mocks.role)) throw createError({ statusCode: 403 })
    return { role: mocks.role }
  }
}))
vi.mock('../../server/utils/siigo-products', () => ({ mutateProduct: mocks.mutate, listProducts: mocks.list, getProductDetail: mocks.detail, getProductContext: mocks.context }))
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
})

describe('autorización y frontera HTTP de productos', () => {
  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'])('rechaza escritura y catálogos de edición para %s', async (role) => {
    mocks.role = role
    for (const route of [create, update, active, context, sat, uploadImage, removeImage]) {
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
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ active: 'true' }))
    expect(mocks.detail).toHaveBeenCalledWith(id, false)
  })
  it('admin puede crear, editar y activar', async () => {
    await create(event({ body }))
    await update(event({ id, body }))
    await active(event({ id, body: { active: false } }))
    expect(mocks.mutate.mock.calls).toEqual([[body], [body, id], [{ active: false }, id]])
  })
  it('rechaza UUID, entrada y filtros inválidos antes de Siigo', async () => {
    await expect(update(event({ id: '../../auth', body }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(create(event({ body: {} }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(active(event({ id, body: { active: false, prices: [] } }))).rejects.toMatchObject({ statusCode: 400 })
    await expect(list(event({ query: { ids: Array(21).fill(id).join(',') } }))).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it('refresh de detalle fuerza lectura fresca', async () => {
    await detail(event({ id, query: { refresh: 'true' } }))
    expect(mocks.detail).toHaveBeenCalledWith(id, true)
  })
})

describe('imágenes de producto', () => {
  const image = { url: 'https://example.supabase.co/storage/v1/object/public/product-images/a.png', updatedAt: '2026-09-15T00:00:00.000Z' }
  it('detalle agrega la imagen local sin mezclarla con Siigo', async () => {
    mocks.detail.mockResolvedValue({ id, code: 'PIN1', name: 'Pintura' })
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
