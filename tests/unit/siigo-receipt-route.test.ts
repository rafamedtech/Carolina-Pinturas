import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  role: 'admin',
  order: vi.fn(),
  find: vi.fn(),
  aggregate: vi.fn(),
  reserve: vi.fn(),
  update: vi.fn()
}))
vi.mock('../../server/utils/auth', () => ({
  requireRole: async (_event: unknown, roles: readonly string[]) => {
    if (!roles.includes(mocks.role)) throw createError({ statusCode: 403 })
    return { role: mocks.role }
  }
}))
vi.mock('../../server/utils/orders', () => ({ getOrder: mocks.order }))
vi.mock('../../server/utils/siigo', () => ({ siigoRequest: mocks.request }))
vi.mock('../../server/utils/siigo-vouchers', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/utils/siigo-vouchers')>(),
  siigoFiscalWritesEnabled: () => true
}))
vi.mock('../../server/utils/siigo-persistence', () => ({ siigoJson: (value: unknown) => value }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({
  salesOrderPayment: { findFirst: mocks.find, aggregate: mocks.aggregate, updateMany: mocks.reserve, update: mocks.update }
}) }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('createError', createError)
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body)
vi.stubGlobal('getRouterParam', (event: Record<string, unknown>, key: string) => event[key])
vi.stubGlobal('useRuntimeConfig', () => ({ siigo: { fiscalWritesEnabled: true } }))
const route = (await import('../../server/api/orders/[id]/payments/[paymentId]/siigo-receipt.post')).default

const invoiceId = '63f918c2-ca65-4edc-a7db-66bcdd5159fb'
const customerId = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'
const voucherId = '497f6eca-6276-4993-bfeb-53cbbbba6f08'
const input = {
  invoiceId, documentTypeId: 7714, paymentTypeId: 5636, costCenterId: 235,
  cfdiCode: '03', paymentMethod: 'PPD', quote: 1, paymentDate: '2026-10-13', stamp: true,
  confirmation: 'CREAR_Y_TIMBRAR_RECEPCION_SIIGO'
}
const invoice = {
  id: invoiceId, name: 'FV-1-68', number: 68, date: '2026-07-20', total: 1000, balance: 1000,
  stamp: { status: 'Accepted', uuid: 'CE0EEAA3-C254-46C9-854D-29CE002802A9' }, payment: { method: 'PPD', conditions: [{ value: 1000 }] },
  customer: { id: customerId, rfc_id: 'MELM8305281H0', branch_office: 0 }
}
let payment: Record<string, unknown>
let customer: Record<string, unknown>
let receipt: Record<string, unknown>
const event = (body: object = input) => ({ id: 'order-1', paymentId: 'payment-1', body }) as Parameters<typeof route>[0]
const writes = () => mocks.request.mock.calls.filter(([, options]) => options?.method)

afterEach(() => vi.useRealTimers())
beforeEach(() => {
  vi.setSystemTime(new Date('2026-10-13T18:00:00Z'))
  vi.clearAllMocks()
  mocks.role = 'admin'
  payment = {
    id: 'payment-1', orderId: 'order-1', requestId: '19ee1240-591d-4b72-87da-ee034838553c',
    provider: 'local', externalStatus: 'not_applicable', externalError: null,
    amount: 500, paymentMethod: 'transferencia', paymentDate: new Date('2026-10-13T00:00:00Z'),
    observations: 'Pedido PED-123', reference: null, currencyCode: 'MXN',
    createdByName: 'Administrador', createdByEmail: 'admin@example.com', createdAt: new Date(),
    siigoVoucherId: null, externalPayload: null
  }
  customer = { id: customerId, name: ['Cliente'], active: true, rfc_id: 'MELM8305281H0', contacts: [{ email: 'actual@cliente.com' }] }
  receipt = {
    id: voucherId, name: 'RC-2-22', number: 22, document: { id: 7714 }, date: '2026-10-13',
    customer: { id: customerId, rfc_id: 'MELM8305281H0' }, cost_center: 235,
    items: [{ due: { prefix: 'FV-1', consecutive: 68, quote: 1, uuid: 'invoice-sat-uuid' }, value: 500 }],
    payments: [{ method: 'PPD', cfdi: { code: '03' }, conditions: [{ id: 5636, value: 500 }] }],
    stamp: { status: 'Draft' }
  }
  mocks.order.mockResolvedValue({ customer: { id: customerId, rfc: 'MELM8305281H0' }, siigoReference: invoiceId, total: 1000 })
  mocks.find.mockImplementation(async () => ({ ...payment }))
  mocks.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
  mocks.reserve.mockImplementation(async ({ data }) => {
    Object.assign(payment, data)
    return { count: 1 }
  })
  mocks.update.mockImplementation(async ({ data }) => {
    Object.assign(payment, data)
    return { ...payment }
  })
  mocks.request.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path.includes('/stamp')) return { status: 'sent' }
    if (path === '/v1/vouchers' && options?.method === 'POST') return { id: voucherId, name: 'RC-2-22' }
    if (path === `/v1/vouchers/${voucherId}`) return receipt
    if (path.includes('/invoices/')) return invoice
    if (path.includes('/customers/')) return customer
    if (path === '/v1/document-types') return [{ id: 7714, code: '2', name: 'Recepción', active: true, automatic_number: true }]
    if (path === '/v1/payment-types') return [{ id: 5636, name: 'Transferencia', active: true }]
    if (path === '/v1/cost-centers') return [{ id: 235, name: 'Matriz', active: true }]
    throw new Error(`Solicitud inesperada: ${path}`)
  })
})

function failedReceipt() {
  Object.assign(payment, {
    provider: 'siigo', externalStatus: 'failed', siigoVoucherId: voucherId, siigoVoucherName: 'RC-2-22',
    siigoInvoiceId: invoiceId, siigoInvoiceName: 'FV-1-68', siigoDocumentTypeId: 7714,
    siigoPaymentTypeId: 5636, siigoCostCenterId: 235, siigoCfdiCode: '03', siigoPaymentMethod: 'PUE', siigoQuote: 1
  })
}

describe('creación y recuperación de recepciones de pago', () => {
  it('rechaza el método no electrónico PUE antes de intentar timbrar un complemento PPD', async () => {
    await expect(route(event({ ...input, paymentMethod: 'PUE' })))
      .rejects.toMatchObject({ statusCode: 400, statusMessage: expect.stringContaining('la recepción debe usar el método PPD') })
    expect(mocks.request).not.toHaveBeenCalled()
    expect(mocks.reserve).not.toHaveBeenCalled()
  })

  it('concilia por lectura una recepción PUE ya aceptada sin enviarla nuevamente', async () => {
    failedReceipt()
    receipt.stamp = { status: 'Accepted' }
    receipt.payments = [{ method: 'PUE', cfdi: { code: '03' }, conditions: [{ id: 5636, value: 500 }] }]
    const result = await route(event({ ...input, paymentMethod: 'PUE', confirmation: 'TIMBRAR_RECEPCION_SIIGO' }))
    expect(result.externalStatus).toBe('synced')
    expect(writes()).toHaveLength(0)
  })

  it.each(['create', 'stamp'] as const)('guarda el diagnóstico y la etapa %s sin repetir la operación fiscal', async (stage) => {
    const implementation = mocks.request.getMockImplementation()!
    const data = {
      Authorization: 'secret-token',
      Errors: [{ Code: 'entry_service', Message: 'Your request could not be completed with the data you submitted. Please verify', Params: ['items'], Detail: 'Detalle de Siigo' }]
    }
    mocks.request.mockImplementation(async (path, options) => {
      if ((stage === 'create' && path === '/v1/vouchers') || (stage === 'stamp' && path.includes('/stamp'))) {
        throw createError({ statusCode: 400, statusMessage: data.Errors[0]!.Message, data })
      }
      return implementation(path, options)
    })
    const result = await route(event())
    expect(result.externalStatus).toBe('failed')
    expect(result.externalError).toContain(stage === 'create' ? 'No se pudo crear' : 'No se pudo timbrar')
    expect(result.externalError).toContain('[entry_service]')
    expect(result.externalError).toContain('Detalle de Siigo')
    expect(payment.externalPayload).toMatchObject({
      request: { date: input.paymentDate },
      failure: { stage, statusCode: 400, errors: [{ code: 'entry_service', params: ['items'], detail: 'Detalle de Siigo' }] },
      ...(stage === 'stamp' ? { created: { id: voucherId } } : {})
    })
    expect(result.siigo?.voucherId).toBe(stage === 'stamp' ? voucherId : null)
    expect(JSON.stringify(payment.externalPayload)).not.toContain('secret-token')
    expect(writes()).toHaveLength(stage === 'stamp' ? 2 : 1)
  })

  it('conserva PPD con efectivo: el tenant aceptó esta combinación el 19/10/2026', async () => {
    await route(event({ ...input, paymentMethod: 'PPD', cfdiCode: '01' }))
    expect(writes()[0]?.[1].body.payment).toMatchObject({ method: 'PPD', cfdi: '01' })
  })

  it('envía rfc_id, correo vigente y la fecha real, incluso si el pago fue ayer', async () => {
    payment.paymentDate = new Date('2026-10-12T00:00:00Z')
    const result = await route(event({ ...input, paymentDate: '2026-10-12' }))
    expect(result.paymentDate).toBe('2026-10-12')
    expect(writes()).toEqual([
      ['/v1/vouchers', expect.objectContaining({ method: 'POST', body: expect.objectContaining({
        date: '2026-10-12', customer: { rfc_id: 'MELM8305281H0', branch_office: 0 },
        observations: 'Pedido PED-123',
        items: [{ due: { prefix: 'FV-1', consecutive: 68, quote: 1, uuid: invoice.stamp.uuid }, value: 500 }]
      }) })],
      [`/v1/vouchers/${voucherId}/stamp`, { method: 'PUT', body: { mail_to: 'actual@cliente.com' } }]
    ])
    expect(mocks.reserve.mock.calls[0]?.[0].data.externalPayload.request.date).toBe('2026-10-12')
    expect(result.externalStatus).toBe('synced')
  })

  it('bloquea antes de crear si no hay correo válido, RFC vigente o factura PPD', async () => {
    customer.contacts = []
    await expect(route(event())).rejects.toMatchObject({ statusCode: 422 })
    customer.contacts = [{ email: 'actual@cliente.com' }]
    customer.rfc_id = 'OTRO010101AA1'
    await expect(route(event())).rejects.toMatchObject({ statusCode: 409 })
    customer.rfc_id = 'MELM8305281H0'
    mocks.request.mockImplementationOnce(async () => ({ ...invoice, payment: { method: 'PUE' } }))
    await expect(route(event())).rejects.toMatchObject({ statusCode: 422 })
    expect(writes()).toHaveLength(0)
    expect(mocks.reserve).not.toHaveBeenCalled()
  })

  it('exige autorización, fecha real y confirmación, y rechaza un correo del navegador', async () => {
    mocks.role = 'repartidor'
    await expect(route(event())).rejects.toMatchObject({ statusCode: 403 })
    mocks.role = 'admin'
    for (const body of [{ ...input, paymentDate: '2026-02-29' }, { ...input, confirmation: 'CREAR_RECEPCION_SIIGO' }, { ...input, stampEmail: 'intruso@ejemplo.com' }]) {
      await expect(route(event(body))).rejects.toMatchObject({ statusCode: 400 })
    }
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('reserva el pago y no crea si otra solicitud ganó la reserva', async () => {
    mocks.reserve.mockResolvedValueOnce({ count: 0 })
    await expect(route(event())).rejects.toMatchObject({ statusCode: 409 })
    expect(writes()).toHaveLength(0)
  })

  it('guarda el ID antes del timbrado y bloquea la recreación tras su rechazo', async () => {
    mocks.request.mockImplementation(async (path, options) => {
      if (path.includes('/stamp')) throw createError({ statusCode: 400, statusMessage: 'Invalid date' })
      if (options?.method) return { id: voucherId }
      if (path.includes('/invoices/')) return invoice
      if (path.includes('/customers/')) return customer
      if (path === '/v1/document-types') return [{ id: 7714, code: '2', name: 'Recepción', active: true }]
      if (path === '/v1/payment-types') return [{ id: 5636, name: 'Transferencia', active: true }]
      return [{ id: 235, name: 'Matriz', active: true }]
    })
    const result = await route(event())
    expect(result.externalStatus).toBe('failed')
    expect(result.siigo?.voucherId).toBe(voucherId)
    await expect(route(event())).rejects.toMatchObject({ statusCode: 409 })
    expect(writes().filter(([, options]) => options.method === 'POST')).toHaveLength(1)
  })

  it('timbra la misma recepción sin repetir POST ni cambiar su fecha', async () => {
    failedReceipt()
    const result = await route(event({ ...input, confirmation: 'TIMBRAR_RECEPCION_SIIGO' }))
    expect(writes()).toEqual([
      [`/v1/vouchers/${voucherId}/stamp`, { method: 'PUT', body: { mail_to: 'actual@cliente.com' } }]
    ])
    expect(result.siigo?.voucherId).toBe(voucherId)
    expect(result.externalStatus).toBe('synced')
  })

  it('una respuesta ambigua conserva unknown y nunca se reintenta automáticamente', async () => {
    const implementation = mocks.request.getMockImplementation()!
    mocks.request.mockImplementation(async (path, options) => {
      if (path === '/v1/vouchers') throw createError({ statusCode: 504 })
      return implementation(path, options)
    })
    expect((await route(event())).externalStatus).toBe('unknown')
    await expect(route(event())).rejects.toMatchObject({ statusCode: 409 })
    expect(writes()).toHaveLength(1)
  })

  it('si ya fue aceptada, concilia sin enviar otra solicitud fiscal', async () => {
    failedReceipt()
    receipt.stamp = { status: 'Accepted' }
    expect((await route(event({ ...input, confirmation: 'TIMBRAR_RECEPCION_SIIGO' }))).externalStatus).toBe('synced')
    expect(writes()).toHaveLength(0)
  })

  it('permite consultar y conciliar un histórico ya aceptado sin volver a timbrarlo', async () => {
    failedReceipt()
    payment.paymentDate = new Date('2026-10-02T00:00:00Z')
    receipt.date = '2026-10-02'
    receipt.stamp = { status: 'Accepted' }
    expect((await route(event({ ...input, paymentDate: '2026-10-02', confirmation: 'TIMBRAR_RECEPCION_SIIGO' }))).externalStatus).toBe('synced')
    expect(writes()).toHaveLength(0)
  })

  it('no timbra una recepción previa que tenga otra fecha que la real del pago', async () => {
    failedReceipt()
    receipt.date = '2026-10-12'
    payment.externalPayload = { request: { date: '2026-10-12' } }
    const body = { ...input, confirmation: 'TIMBRAR_RECEPCION_SIIGO' }
    await expect(route(event(body))).rejects.toMatchObject({ statusCode: 409 })
    expect(writes()).toHaveLength(0)
    expect(mocks.reserve).not.toHaveBeenCalled()
  })

  it('no sustituye el pago del 02/10 por hoy para evitar invalid_date', async () => {
    payment.paymentDate = new Date('2026-10-02T00:00:00Z')
    await expect(route(event({ ...input, paymentDate: '2026-10-02' }))).rejects.toMatchObject({
      statusCode: 422, statusMessage: expect.stringContaining('02/10/2026')
    })
    await expect(route(event())).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.request).not.toHaveBeenCalled()
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(payment.paymentDate).toEqual(new Date('2026-10-02T00:00:00Z'))
  })

  it('rechaza Crédito Clientes antes de crear un ingreso que maneje vencimiento', async () => {
    const implementation = mocks.request.getMockImplementation()!
    mocks.request.mockImplementation(async (path, options) => path === '/v1/payment-types'
      ? [{ id: 3564, name: 'Crédito Clientes', active: true, due_date: true }]
      : implementation(path, options))
    await expect(route(event({ ...input, paymentTypeId: 3564 }))).rejects.toMatchObject({ statusCode: 422 })
    expect(writes()).toHaveLength(0)
  })

  it('no interpreta una respuesta de timbrado vacía como éxito ni vuelve a enviar una recepción rechazada', async () => {
    failedReceipt()
    receipt.stamp = { status: 'Rejected' }
    const body = { ...input, confirmation: 'TIMBRAR_RECEPCION_SIIGO' }
    await expect(route(event(body))).rejects.toMatchObject({ statusCode: 409 })
    expect(writes()).toHaveLength(0)
    receipt.stamp = { status: 'Draft' }
    const implementation = mocks.request.getMockImplementation()!
    mocks.request.mockImplementation(async (path, options) => path.includes('/stamp') ? {} : implementation(path, options))
    expect((await route(event(body))).externalStatus).toBe('unknown')
    await expect(route(event(body))).rejects.toMatchObject({ statusCode: 409 })
  })
})
