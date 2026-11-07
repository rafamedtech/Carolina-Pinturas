import Decimal from 'decimal.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listProductActivity } from '../../server/utils/product-activity'

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }))
vi.mock('../../server/utils/prisma', () => ({
  usePrisma: () => ({ salesOrder: mocks, inventoryMovement: mocks, expense: mocks })
}))

const productId = '290b7a90-23f1-4d41-8ac8-2539b1bfa533'
const date = new Date('2026-10-27T00:00:00Z')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.count.mockResolvedValue(1)
})

describe('actividad del producto', () => {
  it('suma las partidas del producto y conserva el día del pedido', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'order-1', folio: 22, orderDate: date, currencyCode: 'MXN', customerNameSnapshot: 'Cliente',
      status: { key: 'entregado', label: 'Entregado' },
      items: [{ quantity: '0.1', total: '20.10' }, { quantity: '0.2', total: '10.20' }]
    }])

    const { results } = await listProductActivity(productId, 'sales', 1, false)

    expect(results[0]).toMatchObject({
      date: '2026-10-27', reference: 'PED-000022', quantity: '0.3',
      amount: { value: '30.3', currency: 'MXN' }
    })
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { items: { some: { productId } } },
      select: expect.objectContaining({ items: { where: { productId }, select: { quantity: true, total: true } } })
    }))
  })

  it('conserva ambos lados de un traspaso con su saldo por almacén', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'movement-1', folio: 1, date, type: 'traspaso', reason: 'Traspaso',
      lines: [
        { id: 'line-1', warehouseName: 'Origen', delta: new Decimal(-2), balanceAfter: new Decimal(8) },
        { id: 'line-2', warehouseName: 'Destino', delta: new Decimal(2), balanceAfter: new Decimal(12) }
      ]
    }])

    const { results, pagination } = await listProductActivity(productId, 'movements', 1, false)

    expect(results).toMatchObject([
      { context: 'Origen', quantity: '-2', balance: '8' },
      { context: 'Destino', quantity: '+2', balance: '12' }
    ])
    expect(pagination.totalResults).toBe(1)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { lines: { some: { productId } } },
      select: expect.objectContaining({ lines: expect.objectContaining({ where: { productId } }) })
    }))
  })

  it('respeta la visibilidad de gastos vinculados a compras para usuarios operativos', async () => {
    mocks.findMany.mockResolvedValue([])
    await listProductActivity(productId, 'expenses', 2, false)

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: { productId, purchasePaymentId: null, category: { notIn: expect.arrayContaining(['Nómina y honorarios']) } }
    }))
  })
})
