import { describe, expect, it } from 'vitest'
import type { CreateOrderSiigoInvoiceInput } from '../../app/types/siigo-invoices'
import {
  assertInvoiceReferences,
  buildSiigoInvoiceDraftPayload,
  createOrderSiigoInvoiceSchema,
  isUsableFiscalRfc,
  normalizeCreatedInvoice,
  normalizeInvoiceDocumentTypes,
  normalizeInvoiceProduct,
  normalizeSiigoSellers
} from '../../server/utils/siigo-invoices'

const input: CreateOrderSiigoInvoiceInput = {
  documentTypeId: 59625,
  sellerId: 35071,
  paymentTypeId: 5636,
  useCfdi: 'G03',
  paymentMethod: 'PUE',
  date: '2026-07-28',
  dueDate: '2026-07-28',
  confirmation: 'CREAR_BORRADOR_SIIGO'
}

const documentType = {
  id: 59625,
  code: '1',
  name: 'Factura',
  active: true,
  automatic_number: true,
  cost_center: false,
  cost_center_mandatory: false,
  cost_center_default: null,
  discount_type: 'Percentage' as const
}

describe('Siigo invoice drafts', () => {
  it('requires explicit confirmation and valid dates', () => {
    expect(createOrderSiigoInvoiceSchema.safeParse(input).success).toBe(true)
    expect(createOrderSiigoInvoiceSchema.safeParse({
      ...input,
      confirmation: undefined
    }).success).toBe(false)
  })

  it('rejects missing and generic RFCs', () => {
    expect(isUsableFiscalRfc(null)).toBe(false)
    expect(isUsableFiscalRfc('XAXX010101000')).toBe(false)
    expect(isUsableFiscalRfc('XEXX010101000')).toBe(false)
    expect(isUsableFiscalRfc('MELM8305281H0')).toBe(true)
  })

  it('normalizes tenant catalogs without trusting malformed entries', () => {
    expect(normalizeInvoiceDocumentTypes({
      results: [
        documentType,
        { id: 'bad', code: '', name: 'Incompleto' }
      ]
    })).toMatchObject([documentType])
    expect(normalizeSiigoSellers([
      {
        id: 35071,
        first_name: 'Ana',
        last_name: 'Pérez',
        email: 'ana@example.com',
        active: true
      }
    ])).toEqual([{
      id: 35071,
      name: 'Ana Pérez',
      email: 'ana@example.com',
      active: true
    }])
  })

  it('validates all tenant-dependent references', () => {
    expect(assertInvoiceReferences({
      input,
      documentTypes: [documentType],
      sellers: [{ id: 35071, name: 'Ana Pérez', email: null, active: true }],
      paymentTypes: [{ id: 5636, name: 'Contado', active: true }],
      costCenters: [],
      warehouses: []
    })).toMatchObject({ documentType, costCenterId: null })
  })

  it('builds an un-stamped and unsent invoice payload', () => {
    const product = normalizeInvoiceProduct({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      code: 'PINT-01',
      name: 'Pintura blanca',
      active: true,
      taxes: [{ id: 123, name: 'IVA 16%', percentage: 16, type: 'IVA' }]
    })
    const payload = buildSiigoInvoiceDraftPayload({
      input,
      order: {
        folio: 42,
        observations: 'Entregar por la tarde',
        discountAmount: 0,
        total: 232,
        items: [{
          code: 'PINT-01',
          description: 'Pintura blanca',
          quantity: 2,
          unitPrice: 100,
          discountAmount: 0,
          subtotal: 200,
          taxAmount: 32,
          total: 232
        }]
      },
      customerRfc: 'MELM8305281H0',
      products: new Map([[product.code, product]]),
      documentType,
      costCenterId: null
    })

    expect(payload).toMatchObject({
      document: { id: 59625 },
      customer: { rfc_id: 'MELM8305281H0', branch_office: 0 },
      seller: 35071,
      use: 'G03',
      stamp: { send: false },
      mail: { send: false },
      items: [{
        code: 'PINT-01',
        quantity: 2,
        price: 100,
        taxes: [{ id: 123 }]
      }],
      payment: {
        method: 'PUE',
        conditions: {
          id: 5636,
          value: 232,
          due_date: '2026-07-28'
        }
      }
    })
  })

  it('accepts the minimal current create response and rejects invalid ids', () => {
    expect(normalizeCreatedInvoice({
      id: '63f918c2-ca65-4edc-a7db-66bcdd5159fb',
      total: 232
    })).toMatchObject({
      id: '63f918c2-ca65-4edc-a7db-66bcdd5159fb',
      name: null,
      total: 232
    })
    expect(() => normalizeCreatedInvoice({ id: 'not-a-uuid' })).toThrow()
  })
})
