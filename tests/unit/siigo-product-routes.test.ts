import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { productMutationInput } from '../../app/utils/siigoProductMutation'

const mocks = vi.hoisted(() => ({ role: 'admin', mutate: vi.fn(), list: vi.fn(), detail: vi.fn(), context: vi.fn(), sat: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({
  requireRole: async (_event: unknown, roles: readonly string[]) => {
    if (!roles.includes(mocks.role)) throw createError({ statusCode: 403 })
    return { role: mocks.role }
  }
}))
vi.mock('../../server/utils/siigo-products', () => ({ mutateProduct: mocks.mutate, listProducts: mocks.list, getProductDetail: mocks.detail, getProductContext: mocks.context }))
vi.mock('../../server/utils/siigo-product-sat', () => ({ getProductSatCatalog: mocks.sat, searchProductSat: vi.fn() }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('getQuery', (event: { query: unknown }) => event.query || {})
vi.stubGlobal('getRouterParam', (event: { id: string }) => event.id)
vi.stubGlobal('setResponseStatus', vi.fn())
const create = (await import('../../server/api/siigo/products/index.post')).default
const update = (await import('../../server/api/siigo/products/[id].put')).default
const active = (await import('../../server/api/siigo/products/[id]/active.patch')).default
const list = (await import('../../server/api/siigo/products.get')).default
const detail = (await import('../../server/api/siigo/products/[id].get')).default
const context = (await import('../../server/api/siigo/products/context.get')).default
const sat = (await import('../../server/api/siigo/products/sat/index.get')).default
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
    for (const route of [create, update, active, context, sat]) {
      await expect(route(event({ id, body, query: { kind: 'unit' } }))).rejects.toMatchObject({ statusCode: 403 })
    }
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
