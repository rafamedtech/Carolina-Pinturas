import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({
  role: 'admin', order: vi.fn(), request: vi.fn(), customer: vi.fn(),
  reserve: vi.fn(), findOrder: vi.fn(), findInvoice: vi.fn(),
  updateInvoice: vi.fn(), createInvoice: vi.fn(), deleteInvoice: vi.fn(), updateOrder: vi.fn()
}))
vi.mock('../../server/utils/auth', () => ({
  requireRole: async (_event: unknown, roles: string[]) => {
    if (!roles.includes(mocks.role)) throw createError({ statusCode: 403 })
    return { role: mocks.role, name: 'Admin', email: 'admin@example.com' }
  }
}))
vi.mock('../../server/utils/orders', () => ({ getOrder: mocks.order }))
vi.mock('../../server/utils/siigo', () => ({ siigoRequest: mocks.request }))
vi.mock('../../server/utils/siigo-customer-detail', () => ({ getSiigoCustomerDetail: mocks.customer }))
vi.mock('../../server/utils/siigo-persistence', () => ({ siigoJson: (value: unknown) => value }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({
  $transaction: async (callback: (tx: unknown) => unknown) => callback({
    salesOrder: { updateMany: mocks.reserve, findUnique: mocks.findOrder, update: mocks.updateOrder },
    salesOrderSiigoInvoice: {
      findUnique: mocks.findInvoice, update: mocks.updateInvoice,
      create: mocks.createInvoice, deleteMany: mocks.deleteInvoice
    }
  })
}) }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('getRouterParam', (event: { id: string }) => event.id)
const assign = (await import('../../server/api/orders/[id]/siigo-invoice/legacy-assignment.post')).default
const remove = (await import('../../server/api/orders/[id]/siigo-invoice/legacy-assignment.delete')).default
const invoiceId = '63f918c2-ca65-4edc-a7db-66bcdd5159fb'
const customerId = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'
const assignment = { version: 3, invoiceId, confirmation: 'ASIGNAR_FACTURA_HISTORICA' }
const removal = { version: 3, confirmation: 'QUITAR_FACTURA_ASIGNADA' }
const event = (body: unknown) => ({ id: 'order-1', body }) as Parameters<typeof assign>[0]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'admin'
  mocks.order.mockResolvedValue({
    status: { key: 'entregado' }, customer: { id: customerId },
    total: 100, version: 3, siigoReference: 'old-invoice', invoiceCreated: true
  })
  mocks.reserve.mockResolvedValue({ count: 1 })
  mocks.findOrder.mockResolvedValue({ siigoReference: 'old-invoice', siigoInvoice: { status: 'created' } })
  mocks.findInvoice.mockResolvedValue({ status: 'created' })
  mocks.customer.mockResolvedValue({ rfc_id: 'MELM8305281H0' })
  mocks.request.mockResolvedValue({
    id: invoiceId, name: 'FV-1-12', date: '2026-10-13', total: 100,
    document: { id: 1 }, seller: 1, use: { code: 'G03' },
    customer: { id: customerId, rfc_id: 'MELM8305281H0' }, stamp: { status: 'Accepted' },
    payment: { method: 'PPD', conditions: [{ id: 1, value: 100 }] }
  })
})

describe('asociación local de facturas anteriores', () => {
  it('reemplaza la factura existente sin escribir en Siigo', async () => {
    await assign(event(assignment))
    expect(mocks.updateInvoice).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ siigoInvoiceId: invoiceId, status: 'created' })
    }))
    expect(mocks.createInvoice).not.toHaveBeenCalled()
    expect(mocks.updateOrder).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ siigoReference: invoiceId })
    }))
    expect(mocks.request.mock.calls.every(([, options]) => !options?.method)).toBe(true)
  })

  it('quita la asociación sin consultar ni eliminar la factura en Siigo', async () => {
    await remove(event(removal))
    expect(mocks.deleteInvoice).toHaveBeenCalledWith({ where: { orderId: 'order-1' } })
    expect(mocks.updateOrder).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { siigoReference: null, registeredInSiigoAt: null, updatedByEmail: 'admin@example.com' }
    })
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it.each([assign, remove])('rechaza cambios de usuarios sin permiso', async (route) => {
    mocks.role = 'ventas'
    await expect(route(event(route === assign ? assignment : removal))).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.reserve).not.toHaveBeenCalled()
  })

  it.each([assign, remove])('rechaza cambios si la versión quedó desactualizada', async (route) => {
    mocks.reserve.mockResolvedValue({ count: 0 })
    await expect(route(event(route === assign ? assignment : removal))).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.updateInvoice).not.toHaveBeenCalled()
    expect(mocks.deleteInvoice).not.toHaveBeenCalled()
  })

  it.each(['pending', 'uncertain'])('conserva los intentos fiscales %s', async (status) => {
    mocks.findOrder.mockResolvedValue({ siigoInvoice: { status } })
    mocks.findInvoice.mockResolvedValue({ status })
    await expect(assign(event(assignment))).rejects.toMatchObject({ statusCode: 409 })
    await expect(remove(event(removal))).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.deleteInvoice).not.toHaveBeenCalled()
    expect(mocks.updateInvoice).not.toHaveBeenCalled()
  })

  it('conserva la factura anterior si la nueva no coincide con el pedido', async () => {
    mocks.request.mockResolvedValue({ ...(await mocks.request()), total: 200 })
    await expect(assign(event(assignment))).rejects.toMatchObject({ statusCode: 422 })
    expect(mocks.reserve).not.toHaveBeenCalled()
  })

  it('exige confirmación para quitar una asociación', async () => {
    await expect(remove(event({ version: 3 }))).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.deleteInvoice).not.toHaveBeenCalled()
  })
})
