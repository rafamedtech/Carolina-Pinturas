import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppUser } from '../../app/types/siigo'
import { listOrders } from '../../server/utils/orders'

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  aggregate: vi.fn()
}))

vi.mock('../../server/utils/prisma', () => ({
  usePrisma: () => ({
    salesOrder: {
      findMany: mocks.findMany,
      count: mocks.count,
      aggregate: mocks.aggregate
    }
  })
}))

const admin: AppUser = {
  id: 'admin-1',
  name: 'Administrador',
  email: 'admin@example.com',
  role: 'admin',
  repartidorId: null
}

describe('listado de pedidos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findMany.mockResolvedValue([])
    mocks.count.mockResolvedValue(0)
    mocks.aggregate.mockResolvedValue({ _sum: { total: null } })
  })

  it('filtra por el identificador exacto del cliente', async () => {
    const customerId = '9bf22cf2-ba6b-4030-b9a6-3286ea440b61'

    await listOrders({ page: 1, pageSize: 25, customerId }, admin)

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ customerId }])
      })
    }))
    expect(mocks.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{ customerId }])
      })
    }))
  })

  it.each([['created', true], ['failed', false], ['pending', false], [null, false]])('expone la facturación con estado %s', async (invoiceStatus, expected) => {
    mocks.findMany.mockResolvedValue([{
      id: 'order-1', folio: 1,
      status: { key: 'entregado', label: 'Entregado', color: 'success', sortOrder: 1, isTerminal: true },
      customerId: 'customer-1', customerNameSnapshot: 'Cliente', customerRfcSnapshot: null,
      orderDate: new Date('2026-10-19T00:00:00Z'), promisedDate: null,
      total: 100, _count: { items: 1 }, paymentStatus: 'pagado', paymentMethod: 'efectivo',
      siigoInvoice: invoiceStatus ? { status: invoiceStatus } : null,
      createdAt: new Date(), updatedAt: new Date()
    }])
    const result = await listOrders({ page: 1, pageSize: 25, view: 'facturacion' }, admin)
    expect(result.results[0]?.invoiceCreated).toBe(expected)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ siigoInvoice: { select: { status: true } } })
    }))
  })

  it('filtra pedidos por los clientes marcados para la vista interna', async () => {
    await listOrders({ page: 1, pageSize: 25, internalCustomers: true }, admin)

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{
          customer: { isInternalOrderCustomer: true }
        }])
      })
    }))
  })

  it.each([
    ['cotizacion', { statusKey: 'borrador' }],
    ['pendiente_pago', { paymentStatus: { in: ['pendiente_pago', 'abonado'] } }],
    ['entregado', { statusKey: 'entregado' }],
    ['facturacion', { requiresInvoice: true }],
    ['cancelado', { statusKey: 'cancelado' }]
  ] as const)('aplica el filtro de la vista %s', async (view, expectedFilter) => {
    await listOrders({ page: 1, pageSize: 25, view }, admin)

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([expectedFilter])
      })
    }))
  })

  it('separa los pedidos de mostrador de los de vendedor', async () => {
    await listOrders({ page: 1, pageSize: 25, view: 'mostrador' }, admin)

    const counterFilter = {
      OR: [
        { customerNameSnapshot: { equals: 'MOSTRADOR .', mode: 'insensitive' } },
        { customerNameSnapshot: { equals: 'MOSTRADOR', mode: 'insensitive' } }
      ]
    }
    expect(mocks.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([counterFilter])
      })
    }))

    await listOrders({ page: 1, pageSize: 25, view: 'vendedor' }, admin)

    expect(mocks.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([{
          NOT: counterFilter,
          customer: { isInternalOrderCustomer: false }
        }])
      })
    }))
  })

  it('excluye clientes internos en vendedor también del conteo y del importe total', async () => {
    await listOrders({ page: 2, pageSize: 25, view: 'vendedor', search: 'Cliente' }, admin)

    const where = mocks.findMany.mock.calls[0]![0].where
    expect(where.AND).toEqual(expect.arrayContaining([
      expect.objectContaining({ customer: { isInternalOrderCustomer: false } })
    ]))
    expect(mocks.count).toHaveBeenCalledWith({ where })
    expect(mocks.aggregate).toHaveBeenCalledWith({ where, _sum: { total: true } })
  })
})
