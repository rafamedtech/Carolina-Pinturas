import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ role: vi.fn(), body: vi.fn(), mutate: vi.fn(), create: vi.fn(), prisma: { expense: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() }, $queryRaw: vi.fn() } }))
vi.mock('../../server/utils/auth', () => ({ requireRole: mocks.role }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => mocks.prisma }))
vi.mock('../../server/utils/purchases', () => ({ createPurchase: mocks.create, getPurchase: vi.fn(), mutatePurchase: mocks.mutate, purchaseView: vi.fn(), purchaseInclude: {} }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('getRouterParam', () => '00000000-0000-4000-8000-000000000001')
vi.stubGlobal('getQuery', () => ({}))
vi.stubGlobal('readBody', mocks.body)
vi.stubGlobal('setResponseStatus', vi.fn())
const handlers = await Promise.all([
  import('../../server/api/purchases/index.get'), import('../../server/api/purchases/index.post'),
  import('../../server/api/purchases/[id].get'), import('../../server/api/purchases/[id]/actions.post')
])
const expenses = await import('../../server/api/expenses/index.get')
const editExpense = await import('../../server/api/expenses/[id].put')
const deleteExpense = await import('../../server/api/expenses/[id].delete')
const requestId = '00000000-0000-4000-8000-000000000002'
const itemId = '00000000-0000-4000-8000-000000000003'
const receiveCommand = { action: 'receive', date: '2026-11-27', items: [{ itemId, quantity: 4 }] }
function allowOnly(role: string) {
  mocks.role.mockImplementation(async (_event, allowed: string[]) => {
    if (role !== 'admin' && !allowed.includes(role)) throw createError({ statusCode: 403 })
    return { role, id: 'user-1', email: `${role}@example.com` }
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.body.mockReturnValue({})
})
describe('autorización de compras y privacidad de gastos', () => {
  it.each(['vendedor', 'repartidor', 'igualaciones'])('rechaza %s en todas las rutas de compras', async (role) => {
    allowOnly(role)
    for (const handler of handlers) await expect(handler.default({} as never)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('mostrador no crea compras', async () => {
    allowOnly('mostrador')
    await expect(handlers[1].default({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it.each([
    { action: 'confirm' },
    { action: 'cancel', reason: 'Duplicada' },
    { action: 'voidReceipt', id: itemId, reason: 'Error de captura' },
    { action: 'invoice', folio: 'F-1', date: '2026-11-27', dueDate: '2026-12-27', amount: 116 },
    { action: 'pay', invoiceId: itemId, date: '2026-11-27', amount: 116, exchangeRate: 1, method: 'transferencia' }
  ])('mostrador no ejecuta $action', async (command) => {
    allowOnly('mostrador')
    mocks.body.mockReturnValue({ requestId, version: 1, command })
    await expect(handlers[3].default({} as never)).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('mostrador registra recepciones y recibe la compra sin importes', async () => {
    allowOnly('mostrador')
    mocks.body.mockReturnValue({ requestId, version: 1, command: receiveCommand })
    mocks.mutate.mockResolvedValue({ status: 'liquidada', subtotal: 100, vatAmount: 16, total: 116, balance: 0, invoiced: 116, items: [], receipts: [], invoices: [{ id: 'i-1' }], events: [] })
    const result = await handlers[3].default({} as never)
    expect(mocks.mutate).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ status: 'confirmada', total: 0, invoices: [], financialsHidden: true })
  })
  it('admin conserva todas las acciones de compra', async () => {
    allowOnly('admin')
    mocks.body.mockReturnValue({ requestId, version: 1, command: { action: 'confirm' } })
    mocks.mutate.mockResolvedValue({ total: 116 })
    await expect(handlers[3].default({} as never)).resolves.toEqual({ total: 116 })
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
