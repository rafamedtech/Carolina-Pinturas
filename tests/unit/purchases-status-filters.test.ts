import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ role: vi.fn(), findMany: vi.fn(), view: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireRole: mocks.role }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ purchaseOrder: { findMany: mocks.findMany } }) }))
vi.mock('../../server/utils/purchases', () => ({ purchaseView: mocks.view, purchaseInclude: {} }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('getQuery', (event: { query: unknown }) => event.query)

const handler = (await import('../../server/api/purchases/index.get')).default

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role.mockResolvedValue({ role: 'admin' })
  mocks.findMany.mockResolvedValue(['confirmada', 'liquidada', 'vencida'].map(status => ({ status })))
  mocks.view.mockImplementation(row => row)
})

describe('filtros de estados de pago de compras', () => {
  it.each(['confirmada', 'liquidada', 'vencida'])('filtra %s después de calcular el estado de las facturas', async (status) => {
    const result = await handler({ query: { status, search: 'Proveedor', dateFrom: '2026-10-01' } } as never)
    expect(result.results).toEqual([{ status }])
    expect(mocks.findMany.mock.calls[0]![0].where).toMatchObject({
      status: 'confirmada',
      providerName: { contains: 'Proveedor', mode: 'insensitive' },
      date: { gte: new Date('2026-10-01') }
    })
  })
  it('devuelve todos los estados sin filtro', async () => {
    const result = await handler({ query: {} } as never)
    expect(result.results).toHaveLength(3)
    expect(mocks.findMany.mock.calls[0]![0].where).not.toHaveProperty('status')
  })
  it('rechaza estados desconocidos', async () => {
    await expect(handler({ query: { status: 'otro' } } as never)).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.findMany).not.toHaveBeenCalled()
  })
})
