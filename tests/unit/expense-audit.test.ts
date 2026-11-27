import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => {
  const tx = { $queryRawUnsafe: vi.fn(), auditEvent: { create: vi.fn() }, expense: { delete: vi.fn(), findUnique: vi.fn() } }
  return {
    tx,
    role: vi.fn(),
    prisma: {
      expense: { findUnique: vi.fn() },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    }
  }
})
vi.mock('../../server/utils/auth', () => ({ requireRole: mocks.role }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => mocks.prisma }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('getRouterParam', () => 'expense-1')
vi.stubGlobal('setResponseStatus', vi.fn())

const deleteExpense = (await import('../../server/api/expenses/[id].delete')).default
const mostrador = { id: 'user-1', email: 'mostrador@example.com', role: 'mostrador' }
const expense = { id: 'expense-1', category: 'Gasolina', purchasePaymentId: null, amount: '120.50', expenseDate: new Date('2026-11-20T00:00:00.000Z') }

describe('bitácora de gastos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.role.mockResolvedValue(mostrador)
    mocks.prisma.expense.findUnique.mockResolvedValue(expense)
    mocks.tx.expense.findUnique.mockResolvedValue({ ...expense, amount: '130.00' })
  })

  it('bloquea la fila y guarda la foto releída antes de eliminar en la misma transacción', async () => {
    await deleteExpense({} as never)

    expect(mocks.prisma.$transaction).toHaveBeenCalledOnce()
    expect(mocks.tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityType: 'expense',
        entityId: 'expense-1',
        action: 'delete',
        actorEmail: 'mostrador@example.com',
        actorRole: 'mostrador',
        effectiveDate: expense.expenseDate,
        snapshot: expect.objectContaining({ id: 'expense-1', amount: '130.00' })
      })
    })
    expect(mocks.tx.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), 'expense-1')
    expect(mocks.tx.$queryRawUnsafe.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.tx.expense.findUnique.mock.invocationCallOrder[0]!)
    expect(mocks.tx.expense.delete).toHaveBeenCalledWith({ where: { id: 'expense-1' } })
    expect(mocks.tx.auditEvent.create.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.tx.expense.delete.mock.invocationCallOrder[0]!)
  })

  it('responde 404 sin auditar si el gasto desaparece antes del bloqueo', async () => {
    mocks.tx.expense.findUnique.mockResolvedValue(null)
    await expect(deleteExpense({} as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.tx.auditEvent.create).not.toHaveBeenCalled()
    expect(mocks.tx.expense.delete).not.toHaveBeenCalled()
  })

  it('omite los payloads crudos de Siigo en la foto', async () => {
    mocks.tx.expense.findUnique.mockResolvedValue({ ...expense, providerPayload: { raw: true } })
    await deleteExpense({} as never)
    expect(mocks.tx.auditEvent.create.mock.calls[0]![0].data.snapshot).not.toHaveProperty('providerPayload')
  })

  it('no registra nada si el gasto pertenece a un abono de compra', async () => {
    mocks.prisma.expense.findUnique.mockResolvedValue({ ...expense, purchasePaymentId: 'payment-1' })
    await expect(deleteExpense({} as never)).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled()
  })
})
