import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), getOrder: vi.fn(), updateMany: vi.fn() }))
vi.mock('../../server/utils/auth', () => ({ requireRole: mocks.requireRole }))
vi.mock('../../server/utils/orders', () => ({ getOrder: mocks.getOrder }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({ salesOrderSiigoInvoice: { updateMany: mocks.updateMany } }) }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('getRouterParam', (event: { id: string }) => event.id)
const handler = (await import('../../server/api/orders/[id]/siigo-invoice/nube-link.patch')).default
const invoiceId = 'e6403695-032f-4711-842b-dd7b95bcf008'
const body = { invoiceId, url: 'https://siigonube.siigo.mx/#/invoice/843/87200', confirmed: true }
const event = (data = body) => ({ id: 'order-1', body: data }) as unknown as Parameters<typeof handler>[0]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue({ role: 'admin' })
  mocks.getOrder.mockResolvedValue({})
  mocks.updateMany.mockResolvedValue({ count: 1 })
})

describe('guardar enlace de Siigo por factura', () => {
  it('guarda únicamente el código numérico y exige que la factura siga asignada', async () => {
    await expect(handler(event())).resolves.toMatchObject({ invoiceNubeCode: 87200 })
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1', status: 'created', siigoInvoiceId: invoiceId, order: { siigoReference: invoiceId } },
      data: { nubeInvoiceCode: 87200 }
    })
  })
  it('rechaza un enlace ajeno a Siigo antes de escribir', async () => {
    await expect(handler(event({ ...body, url: 'https://evil.test' }))).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
  it('exige confirmación de que el enlace corresponde a la factura', async () => {
    await expect(handler(event({ ...body, confirmed: false }))).rejects.toMatchObject({ statusCode: 400 })
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
  it('rechaza una factura sustituida durante la edición', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 409 })
  })
  it('exige autorización y acceso al pedido antes de escribir', async () => {
    mocks.requireRole.mockRejectedValue(createError({ statusCode: 403 }))
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.updateMany).not.toHaveBeenCalled()
    mocks.requireRole.mockResolvedValue({ role: 'admin' })
    mocks.getOrder.mockRejectedValue(createError({ statusCode: 404 }))
    await expect(handler(event())).rejects.toMatchObject({ statusCode: 404 })
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
})
