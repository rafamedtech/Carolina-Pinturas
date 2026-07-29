import { describe, expect, it } from 'vitest'
import type { CreateOrderSiigoPaymentInput } from '../../app/types/siigo-payments'
import {
  assertVoucherReferences,
  buildSiigoVoucherPayload,
  createOrderSiigoPaymentSchema,
  invoicePrefix,
  normalizeCreatedVoucher,
  normalizeInvoiceDetail,
  normalizePayableInvoices
} from '../../server/utils/siigo-vouchers'

const invoiceId = '63f918c2-ca65-4edc-a7db-66bcdd5159fb'
const customerId = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'

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

  it('normaliza sólo facturas con saldo y tolera rfc.id en respuestas', () => {
    expect(normalizePayableInvoices({
      results: [
        invoice({ customer: { 'id': customerId, 'rfc.id': 'MELM8305281H0' } }),
        invoice({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', balance: 0 })
      ]
    })).toEqual([expect.objectContaining({
      id: invoiceId,
      balance: 2546.06,
      customerRfc: 'MELM8305281H0'
    })])
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

  it('falla si Siigo responde sin un identificador de recepción válido', () => {
    expect(normalizeCreatedVoucher({
      id: '497f6eca-6276-4993-bfeb-53cbbbba6f08',
      name: 'RC-2-22'
    })).toMatchObject({ id: '497f6eca-6276-4993-bfeb-53cbbbba6f08', name: 'RC-2-22' })
    expect(() => normalizeCreatedVoucher({ name: 'RC-2-22' })).toThrow()
  })
})
