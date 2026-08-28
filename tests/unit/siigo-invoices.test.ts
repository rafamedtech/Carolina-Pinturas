import { describe, expect, it } from 'vitest'
import type { CreateOrderSiigoInvoiceInput } from '../../app/types/siigo-invoices'
import {
  assertInvoiceReferences,
  buildSiigoInvoiceDraftPayload,
  createOrderSiigoInvoiceSchema,
  isSiigoInvoiceWriteEnabled,
  isUsableFiscalRfc,
  missingInvoiceCustomerFields,
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
  paymentMethod: 'PPD',
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
  it('enables invoice writes only for an explicit true setting', () => {
    expect(isSiigoInvoiceWriteEnabled(true)).toBe(true)
    expect(isSiigoInvoiceWriteEnabled('true')).toBe(true)
    expect(isSiigoInvoiceWriteEnabled(false)).toBe(false)
    expect(isSiigoInvoiceWriteEnabled('false')).toBe(false)
    expect(isSiigoInvoiceWriteEnabled(undefined)).toBe(false)
  })

  it('requires explicit confirmation and valid dates', () => {
    expect(createOrderSiigoInvoiceSchema.safeParse(input).success).toBe(true)
    expect(createOrderSiigoInvoiceSchema.safeParse({
      ...input,
      paymentMethod: 'PUE'
    }).success).toBe(false)
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

  it('requires only an active customer with a usable RFC before invoicing', () => {
    const completeCustomer = {
      id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
      name: ['Rafael', 'Valenzuela'],
      person_type: 'Physical',
      rfc_id: 'VAGR8902073DA',
      fiscal_regime: '612',
      active: true,
      address: {
        street: 'Calle 5',
        postal_code: '22000',
        city: { country_code: 'Mx', state_code: '2', city_code: '4' }
      }
    }

    expect(missingInvoiceCustomerFields(completeCustomer)).toEqual([])
    expect(missingInvoiceCustomerFields({
      ...completeCustomer,
      active: false,
      fiscal_regime: undefined,
      address: undefined
    })).toEqual(['cliente activo'])
    expect(missingInvoiceCustomerFields({
      ...completeCustomer,
      rfc_id: 'XAXX010101000',
      fiscal_regime: undefined,
      address: undefined
    })).toEqual(['RFC fiscal válido'])
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
      customerBranchOffice: 3,
      products: new Map([[product.code, product]]),
      documentType,
      costCenterId: null
    })

    expect(payload).toMatchObject({
      document: { id: 59625 },
      customer: { rfc_id: 'MELM8305281H0', branch_office: 3 },
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
        method: 'PPD',
        conditions: [{
          id: 5636,
          value: 232,
          due_date: '2026-07-28'
        }]
      }
    })
    expect(Array.isArray(payload.payment.conditions)).toBe(true)
  })

  it('sends the pre-tax base when the displayed product price includes tax', () => {
    const product = normalizeInvoiceProduct({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      code: 'YU700-19L',
      name: 'Producto con IVA incluido',
      active: true,
      tax_included: true,
      taxes: [{ id: 8, name: 'IVA 8%', percentage: 8, type: 'IVA' }]
    })
    const payload = buildSiigoInvoiceDraftPayload({
      input,
      order: {
        folio: 12,
        observations: null,
        discountAmount: 0,
        total: 1780,
        items: [{
          code: 'YU700-19L',
          description: null,
          quantity: 1,
          unitPrice: 1780,
          discountAmount: 0,
          subtotal: 1648.15,
          taxAmount: 131.85,
          total: 1780
        }]
      },
      customerRfc: 'MELM8305281H0',
      products: new Map([[product.code, product]]),
      documentType,
      costCenterId: null
    })

    expect(payload.items[0]).toMatchObject({
      code: 'YU700-19L',
      quantity: 1,
      price: 1648.15,
      taxes: [{ id: 8 }]
    })
    expect(payload.payment.conditions).toEqual([{
      id: 5636,
      value: 1780,
      due_date: '2026-07-28'
    }])
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
