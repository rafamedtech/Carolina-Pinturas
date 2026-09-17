import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ role: vi.fn(), prisma: { expense: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() }, $queryRaw: vi.fn() } }))
vi.mock('../../server/utils/auth', () => ({ requireRole: mocks.role }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => mocks.prisma }))
vi.mock('../../server/utils/purchases', () => ({ createPurchase: vi.fn(), getPurchase: vi.fn(), mutatePurchase: vi.fn(), purchaseView: vi.fn(), purchaseInclude: {} }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('getRouterParam', () => '00000000-0000-4000-8000-000000000001')
vi.stubGlobal('getQuery', () => ({}))
vi.stubGlobal('readBody', () => ({}))
vi.stubGlobal('setResponseStatus', vi.fn())
const handlers = await Promise.all([
  import('../../server/api/purchases/index.get'), import('../../server/api/purchases/index.post'),
  import('../../server/api/purchases/[id].get'), import('../../server/api/purchases/[id]/actions.post')
])
const expenses = await import('../../server/api/expenses/index.get')
const editExpense = await import('../../server/api/expenses/[id].put')
const deleteExpense = await import('../../server/api/expenses/[id].delete')
beforeEach(() => {
  vi.clearAllMocks()
})
describe('autorización de compras y privacidad de gastos', () => {
  it.each(['mostrador', 'vendedor', 'repartidor', 'igualaciones'])('rechaza %s en todas las rutas de compras', async (role) => {
    mocks.role.mockImplementation(async (_event, allowed: string[]) => {
      if (!allowed.includes(role)) throw createError({ statusCode: 403 })
      return { role }
    })
    for (const handler of handlers) await expect(handler.default({} as never)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('filtra filas, conteos y suma SQL para vendedor', async () => {
    mocks.role.mockResolvedValue({ role: 'vendedor' })
    mocks.prisma.expense.findMany.mockResolvedValue([])
    mocks.prisma.expense.count.mockResolvedValue(0)
    mocks.prisma.$queryRaw.mockResolvedValue([{ total: 0 }])
    await expenses.default({} as never)
    expect(mocks.prisma.expense.findMany.mock.calls[0]![0].where.AND).toContainEqual({ purchasePaymentId: null })
    expect(mocks.prisma.expense.count.mock.calls[0]![0].where.AND).toContainEqual({ purchasePaymentId: null })
    const sql = mocks.prisma.$queryRaw.mock.calls[0]![1]
    expect(sql.sql).toContain('purchase_payment_id IS NULL')
  })
  it.each(['admin', 'vendedor'])('impide modificar/eliminar gasto vinculado como %s', async (role) => {
    mocks.role.mockResolvedValue({ role })
    mocks.prisma.expense.findUnique.mockResolvedValue({ id: 'expense', category: 'Compra de materiales', purchasePaymentId: 'payment' })
    for (const handler of [editExpense, deleteExpense]) await expect(handler.default({} as never)).rejects.toMatchObject({ statusCode: role === 'admin' ? 409 : 404 })
  })
})
