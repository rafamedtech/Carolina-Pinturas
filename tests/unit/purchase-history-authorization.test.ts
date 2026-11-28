import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { canAccessAppPath } from '../../app/utils/roleAccess'

const mocks = vi.hoisted(() => ({ role: vi.fn(), list: vi.fn(), query: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireRole: mocks.role }))
vi.mock('../../server/utils/purchase-history', () => ({ listPurchaseHistory: mocks.list }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('getQuery', mocks.query)
const handler = (await import('../../server/api/purchases/items.get')).default

function allowOnly(role: string) {
  mocks.role.mockImplementation(async (_event, allowed: string[]) => {
    if (role !== 'admin' && !allowed.includes(role)) throw createError({ statusCode: 403 })
    return { role }
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.query.mockReturnValue({})
  mocks.list.mockResolvedValue({ results: [] })
})

describe('historial de compras por partida (CVR-04)', () => {
  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'])('rechaza %s porque muestra costos', async (role) => {
    allowOnly(role)
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it('admin consulta con filtros por producto, proveedor y periodo', async () => {
    allowOnly('admin')
    const productId = '00000000-0000-4000-8000-000000000001'
    const providerId = '00000000-0000-4000-8000-000000000002'
    mocks.query.mockReturnValue({ productId, providerId, dateFrom: '2026-11-01', dateTo: '2026-11-30', page: '2' })
    await handler({} as never)
    expect(mocks.role).toHaveBeenCalledWith(expect.anything(), ['admin'])
    expect(mocks.list).toHaveBeenCalledWith({ productId, providerId, dateFrom: '2026-11-01', dateTo: '2026-11-30', page: 2, page_size: 25, options: true })
  })
  it.each([
    { productId: 'no-uuid' },
    { dateFrom: '2026-02-30' },
    { dateFrom: '2026-12-01', dateTo: '2026-11-01' },
    { page: '0' },
    { page: '1001' },
    { page_size: '101' }
  ])('rechaza filtros inválidos %o', async (query) => {
    allowOnly('admin')
    mocks.query.mockReturnValue(query)
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it('la página /compras/historial es solo de admin (y consulta en lectura)', () => {
    expect(canAccessAppPath('admin', '/compras/historial')).toBe(true)
    expect(canAccessAppPath('consulta', '/compras/historial')).toBe(true)
    for (const role of ['mostrador', 'vendedor', 'repartidor', 'igualaciones'] as const) expect(canAccessAppPath(role, '/compras/historial')).toBe(false)
  })
})
