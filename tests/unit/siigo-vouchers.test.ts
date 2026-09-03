import { describe, expect, it } from 'vitest'
import type { CreateOrderSiigoPaymentInput } from '../../app/types/siigo-payments'
import {
  assertHistoricalReceiptMatchesPayment,
  assertVoucherReferences,
  assignHistoricalSiigoReceiptSchema,
  buildSiigoVoucherPayload,
  createOrderSiigoReceiptSchema,
  createOrderSiigoPaymentSchema,
  isSiigoInvoiceStamped,
  invoicePrefix,
  normalizeCreatedVoucher,
  normalizeHistoricalReceiptDetail,
  normalizeHistoricalReceiptOptions,
  normalizeInvoiceDetail,
  normalizePayableInvoices,
  payableInvoicesForCustomer
} from '../../server/utils/siigo-vouchers'

const invoiceId = '63f918c2-ca65-4edc-a7db-66bcdd5159fb'
const customerId = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'
const voucherId = '497f6eca-6276-4993-bfeb-53cbbbba6f08'

function input(overrides: Partial<CreateOrderSiigoPaymentInput> = {}): CreateOrderSiigoPaymentInput {
  return {
    destination: 'siigo',
    requestId: '19ee1240-591d-4b72-87da-ee034838553c',
    invoiceId,
    documentTypeId: 7714,
    paymentTypeId: 5636,
    costCenterId: 235,
    cfdiCode: '03',
    paymentMethod: 'PUE',
    amount: 1273.03,
    date: '2026-07-28',
    quote: 1,
    observations: 'Pedido PED-000123',
    confirmation: 'CREAR_RECEPCION_SIIGO',
    ...overrides
  }
}

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: invoiceId,
    document: { id: 24446 },
    number: 68,
    name: 'FV-1-68',
    date: '2026-07-20',
    customer: {
      id: customerId,
      rfc_id: 'MELM8305281H0',
      branch_office: 0
    },
    total: 2546.06,
    balance: 2546.06,
    ...overrides
  }
}

function voucher(overrides: Record<string, unknown> = {}) {
  return {
    id: voucherId,
    document: { id: 7714 },
    number: 22,
    name: 'RC-2-22',
    date: '2026-07-28',
    customer: {
      'id': customerId,
      'rfc.id': 'MELM8305281H0'
    },
    cost_center: 235,
    items: [{
      due: { prefix: 'FV-1', consecutive: 68, quote: 1 },
      value: 1273.03
    }],
    payments: [{
      method: 'PUE',
      cfdi: { code: '03', name: 'Transferencia electrónica' },
      conditions: [{ id: 5636, name: 'Transferencia', value: 1273.03 }]
    }],
    stamp: { status: 'Draft' },
    ...overrides
  }
}

function references(overrides: Record<string, unknown> = {}) {
  return {
    input: input(),
    invoice: invoice(),
    orderCustomerId: customerId,
    orderCustomerRfc: 'MELM8305281H0',
    documentTypes: [{
      id: 7714,
      code: '2',
      name: 'Recepción',
      active: true,
      cost_center: true,
      cost_center_mandatory: true,
      automatic_number: true
    }],
    paymentTypes: [{ id: 5636, name: 'Transferencia', active: true }],
    costCenters: [{ id: 235, name: 'Matriz', active: true }],
    ...overrides
  }
}

describe('recepciones de pago de Siigo México', () => {
  it('considera timbrada únicamente una factura aceptada por Siigo', () => {
    expect(isSiigoInvoiceStamped('Accepted')).toBe(true)
    expect(isSiigoInvoiceStamped('Draft')).toBe(false)
    expect(isSiigoInvoiceStamped('Sending')).toBe(false)
    expect(isSiigoInvoiceStamped('Rejected')).toBe(false)
    expect(isSiigoInvoiceStamped(null)).toBe(false)
  })

  it('separa la configuración fiscal de los datos inmutables del pago local', () => {
    expect(createOrderSiigoReceiptSchema.safeParse({
      invoiceId,
      documentTypeId: 7714,
      paymentTypeId: 5636,
      cfdiCode: '03',
      paymentMethod: 'PUE',
      quote: 1,
      confirmation: 'CREAR_RECEPCION_SIIGO'
    }).success).toBe(true)
    expect(createOrderSiigoReceiptSchema.safeParse({
      ...input(),
      amount: 1
    }).success).toBe(false)
  })

  it('exige correo y confirmación específica para crear y timbrar una recepción', () => {
    const receipt = {
      invoiceId,
      documentTypeId: 7714,
      paymentTypeId: 5636,
      cfdiCode: '03',
      paymentMethod: 'PUE',
      quote: 1,
      stamp: true
    }
    expect(createOrderSiigoReceiptSchema.safeParse({
      ...receipt,
      stampEmail: 'cliente@example.com',
      confirmation: 'CREAR_Y_TIMBRAR_RECEPCION_SIIGO'
    }).success).toBe(true)
    expect(createOrderSiigoReceiptSchema.safeParse({
      ...receipt,
      confirmation: 'CREAR_Y_TIMBRAR_RECEPCION_SIIGO'
    }).success).toBe(false)
    expect(createOrderSiigoReceiptSchema.safeParse({
      ...receipt,
      stampEmail: 'cliente@example.com',
      confirmation: 'CREAR_RECEPCION_SIIGO'
    }).success).toBe(false)
  })

  it('valida importe con máximo dos decimales y confirmación fiscal explícita', () => {
    expect(createOrderSiigoPaymentSchema.safeParse(input()).success).toBe(true)
    expect(createOrderSiigoPaymentSchema.safeParse(input({ amount: 10.001 })).success).toBe(false)
    expect(createOrderSiigoPaymentSchema.safeParse({
      ...input(),
      confirmation: undefined
    }).success).toBe(false)
  })

  it('deriva el prefijo usando el consecutivo documentado por Siigo', () => {
    expect(invoicePrefix(invoice())).toBe('FV-1')
    expect(() => invoicePrefix({ name: 'FACTURA-68', number: 22 })).toThrow()
  })

  it('arma el payload oficial sin fijar IDs configurables', () => {
    const result = assertVoucherReferences(references())
    const payload = buildSiigoVoucherPayload({
      input: input(),
      invoice: invoice(),
      customerRfc: 'MELM8305281H0',
      prefix: result.prefix
    })

    expect(payload).toEqual({
      document: { id: 7714 },
      date: '2026-07-28',
      // Regresión documental 2026-07-28: el request schema y ejemplo oficiales
      // usan la clave literal "rfc.id", aunque la tabla diga customer.rfc_id.
      customer: {
        'rfc.id': 'MELM8305281H0',
        'branch_office': 0
      },
      cost_center: 235,
      items: [{
        due: {
          prefix: 'FV-1',
          consecutive: 68,
          quote: 1
        },
        value: 1273.03
      }],
      payment: {
        method: 'PUE',
        cfdi: '03',
        conditions: [{ id: 5636, value: 1273.03 }]
      },
      observations: 'Pedido PED-000123'
    })
  })

  it('rechaza facturas de otro cliente, saldos insuficientes y catálogos inactivos', () => {
    expect(() => assertVoucherReferences(references({
      invoice: invoice({ customer: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', rfc_id: 'OTRO010101AA1' } })
    }))).toThrow()
    expect(() => assertVoucherReferences(references({
      invoice: invoice({ balance: 100 })
    }))).toThrow()
    expect(() => assertVoucherReferences(references({
      paymentTypes: [{ id: 5636, name: 'Transferencia', active: false }]
    }))).toThrow()
  })

  it('normaliza sólo facturas con saldo y tolera las variantes de RFC en respuestas', () => {
    expect(normalizePayableInvoices({
      results: [
        invoice({ customer: { 'id': customerId, 'rfc.id': 'MELM8305281H0' } }),
        invoice({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          customer: { identification: 'MELM8305281H0' }
        }),
        invoice({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', balance: 0 })
      ]
    })).toEqual([
      expect.objectContaining({
        id: invoiceId,
        balance: 2546.06,
        customerRfc: 'MELM8305281H0'
      }),
      expect.objectContaining({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        customerRfc: 'MELM8305281H0'
      })
    ])
  })

  it('filtra las facturas por cliente y conserva la asociada explícitamente al pedido', () => {
    const preferredInvoiceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const otherCustomerInvoiceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

    expect(payableInvoicesForCustomer({
      results: [
        invoice(),
        invoice({
          id: otherCustomerInvoiceId,
          name: 'FV-1-70',
          customer: {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            rfc_id: 'OTRO010101AA1'
          }
        })
      ]
    }, {
      customerId,
      customerRfc: 'MELM8305281H0',
      preferredInvoiceId,
      preferredInvoice: invoice({
        id: preferredInvoiceId,
        name: 'FV-1-69',
        balance: 0,
        customer: {},
        stamp: { status: 'Draft' },
        payment: {
          method: 'PPD',
          conditions: [{ id: 3564, value: 2546.06 }]
        }
      }),
      preferredBalance: 1000
    }).map(invoice => invoice.id)).toEqual([
      preferredInvoiceId,
      invoiceId
    ])
  })

  it('conserva la factura asignada en el selector aunque Siigo reporte saldo cero', () => {
    const assigned = invoice({
      balance: 0,
      stamp: { status: 'Accepted' }
    })

    expect(payableInvoicesForCustomer({ results: [] }, {
      customerId,
      customerRfc: 'MELM8305281H0',
      preferredInvoiceId: invoiceId,
      preferredInvoice: assigned,
      preferredBalance: 1273.03
    })).toEqual([
      expect.objectContaining({
        id: invoiceId,
        name: 'FV-1-68',
        balance: 0,
        stamped: true
      })
    ])
  })

  it('normaliza el detalle de factura y rechaza respuestas incompletas', () => {
    expect(normalizeInvoiceDetail(invoice())).toMatchObject({
      id: invoiceId,
      name: 'FV-1-68',
      number: 68,
      balance: 2546.06,
      customer: {
        id: customerId,
        rfc_id: 'MELM8305281H0',
        branch_office: 0
      }
    })
    expect(() => normalizeInvoiceDetail({ id: invoiceId, name: 'FV-1-68' })).toThrow()
  })

  it('usa la condición pendiente de una factura PPD cuando Siigo reporta saldo cero', () => {
    const draft = invoice({
      balance: 0,
      stamp: { status: 'Draft' },
      payment: {
        method: 'PPD',
        conditions: [{ id: 3564, value: 110 }]
      }
    })

    expect(normalizeInvoiceDetail(draft, { ppdBalanceLimit: 80 }).balance).toBe(80)
    expect(normalizePayableInvoices({ results: [draft] })).toEqual([])
    expect(normalizePayableInvoices(
      { results: [draft] },
      { ppdBalanceLimit: 80 }
    )[0]?.balance).toBe(80)

    const stamped = invoice({
      balance: 0,
      stamp: { status: 'Accepted' },
      payment: {
        method: 'PPD',
        conditions: [{ id: 3564, value: 1273.03 }]
      }
    })
    const normalized = normalizeInvoiceDetail(stamped, { ppdBalanceLimit: 1273.03 })
    expect(normalized.balance).toBe(1273.03)
    expect(() => assertVoucherReferences(references({ invoice: normalized }))).not.toThrow()
    expect(normalizeInvoiceDetail(stamped, { ppdBalanceLimit: 500 }).balance).toBe(500)
  })

  it('falla si Siigo responde sin un identificador de recepción válido', () => {
    expect(normalizeCreatedVoucher({
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      name: 'RC-2-22'
    })).toMatchObject({ id: '497f6eca-6276-4993-bfeb-53cbbbba6f08', name: 'RC-2-22' })
    expect(() => normalizeCreatedVoucher({ name: 'RC-2-22' })).toThrow()
  })

  it('detecta recepciones existentes de la factura con la fecha e importe del pago local', () => {
    const invoiceDetail = normalizeInvoiceDetail(invoice())
    expect(normalizeHistoricalReceiptOptions({
      results: [
        voucher(),
        voucher({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', date: '2026-07-29' }),
        voucher({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          items: [{ due: { prefix: 'FV-9', consecutive: 68, quote: 1 }, value: 1273.03 }]
        })
      ]
    }, {
      invoice: invoiceDetail,
      customerId,
      customerRfc: 'MELM8305281H0',
      amount: 1273.03,
      date: '2026-07-28'
    })).toEqual([{
      id: voucherId,
      name: 'RC-2-22',
      date: '2026-07-28',
      amount: 1273.03,
      quote: 1,
      stampStatus: 'Draft'
    }])
  })

  it('normaliza payment singular y revalida la recepción antes de asignarla', () => {
    const source = voucher({
      payments: undefined,
      payment: {
        method: 'PUE',
        cfdi: '03',
        conditions: [{ id: 5636, value: 1273.03 }]
      }
    })
    const receipt = normalizeHistoricalReceiptDetail(source)
    expect(receipt).toMatchObject({
      id: voucherId,
      documentTypeId: 7714,
      paymentTypeId: 5636,
      cfdiCode: '03',
      paymentMethod: 'PUE',
      prefix: 'FV-1',
      consecutive: 68,
      quote: 1
    })
    expect(() => assertHistoricalReceiptMatchesPayment(receipt, {
      voucherId,
      invoice: normalizeInvoiceDetail(invoice()),
      customerId,
      customerRfc: 'MELM8305281H0',
      amount: 1273.03,
      date: '2026-07-28'
    })).not.toThrow()
  })

  it('rechaza recepciones ambiguas, importes distintos y confirmaciones incompletas', () => {
    expect(() => normalizeHistoricalReceiptDetail(voucher({
      items: [
        { due: { prefix: 'FV-1', consecutive: 68, quote: 1 }, value: 1000 },
        { due: { prefix: 'FV-2', consecutive: 10, quote: 1 }, value: 273.03 }
      ]
    }))).toThrow()
    expect(normalizeHistoricalReceiptOptions({
      results: [voucher()]
    }, {
      invoice: normalizeInvoiceDetail(invoice()),
      customerId,
      customerRfc: 'MELM8305281H0',
      amount: 1273.04,
      date: '2026-07-28'
    })).toEqual([])
    expect(() => normalizeHistoricalReceiptDetail(voucher({
      payments: [{
        method: 'PUE',
        cfdi: { code: '03' },
        conditions: [{ id: 5636, value: 100 }]
      }]
    }))).toThrow()
    expect(assignHistoricalSiigoReceiptSchema.safeParse({
      voucherId,
      confirmation: 'ASIGNAR_RECEPCION_HISTORICA'
    }).success).toBe(true)
    expect(assignHistoricalSiigoReceiptSchema.safeParse({
      voucherId,
      confirmation: 'ASIGNAR_RECEPCION_HISTORICA',
      amount: 1
    }).success).toBe(false)
  })
})
