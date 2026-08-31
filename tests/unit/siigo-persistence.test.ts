import { describe, expect, it, vi } from 'vitest'
import type { SiigoCustomer, SiigoProduct } from '../../app/types/siigo'
import {
  upsertSiigoCustomer,
  upsertSiigoProduct
} from '../../server/utils/siigo-persistence'

describe('persistencia de snapshots de Siigo', () => {
  it('sincroniza el producto 02022 con una sola escritura anidada', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined)
    const tx = { siigoProduct: { upsert } } as unknown as Parameters<typeof upsertSiigoProduct>[0]
    const product: SiigoProduct = {
      id: 'b97745ff-608f-4978-9b49-eced0b513123',
      code: '02022',
      name: '3M LIJA WETORDRY 5 X 9 G-1200',
      type: 'Product',
      active: true,
      tax_included: true,
      prices: [{
        currency_code: 'MXN',
        price_list: [{ position: 1, name: 'Precio de venta 1', value: 28 }]
      }],
      taxes: [{ id: 46205, name: 'IVA 8%', type: 'IVA', percentage: 8 }],
      warehouses: [],
      available_quantity: 0,
      unit: { code: 'H87', name: 'Pieza' },
      key: { code: '31191500', name: 'Abrasivos y medios de abrasivo' },
      metadata: { created: '2026-07-17T13:31:00.653Z' }
    }

    await upsertSiigoProduct(tx, product)

    expect(upsert).toHaveBeenCalledOnce()
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: product.id },
      create: expect.objectContaining({
        id: product.id,
        prices: { create: [expect.objectContaining({ position: 1, value: '28' })] },
        taxes: { create: [expect.objectContaining({ siigoTaxId: 46205, percentage: '8' })] },
        warehouses: { create: [] },
        components: { create: [] }
      }),
      update: expect.objectContaining({
        prices: {
          deleteMany: {},
          create: [expect.objectContaining({ position: 1, value: '28' })]
        },
        taxes: {
          deleteMany: {},
          create: [expect.objectContaining({ siigoTaxId: 46205, percentage: '8' })]
        },
        warehouses: { deleteMany: {}, create: [] },
        components: { deleteMany: {}, create: [] }
      })
    }))
  })

  it('sustituye teléfonos y contactos dentro del upsert del cliente', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined)
    const tx = { siigoCustomer: { upsert } } as unknown as Parameters<typeof upsertSiigoCustomer>[0]
    const customer: SiigoCustomer = {
      id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
      name: ['María', 'López'],
      type: 'Supplier',
      rfc_id: 'LOMA850101AB1',
      commercial_name: 'Pinturas María',
      branch_office: 2,
      comments: 'Cliente preferente',
      seller_id: 21,
      address: {
        street: 'Av. Reforma',
        city: { country_code: 'MX', state_code: '02', city_code: '001' }
      },
      phones: [{ indicative: '52', number: '5512345678', extension: '10' }],
      contacts: [{
        first_name: 'María',
        last_name: 'López',
        email: 'maria@example.com',
        phone: { indicative: '52', number: '5587654321', extension: '20' }
      }]
    }

    await upsertSiigoCustomer(tx, customer, {
      internal: {
        code: 'CLI-001',
        notes: 'Crédito autorizado',
        tags: ['mayoreo'],
        requiresInvoice: true
      },
      updatedByEmail: 'vendedor@example.com'
    })

    expect(upsert).toHaveBeenCalledOnce()
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        commercialName: 'Pinturas María',
        branchOffice: 2,
        isCustomer: false,
        isSupplier: true,
        internalCode: 'CLI-001',
        internalTags: ['mayoreo'],
        requiresInvoice: true,
        createdByEmail: 'vendedor@example.com',
        phones: { create: [expect.objectContaining({
          position: 1,
          indicative: '52',
          number: '5512345678',
          extension: '10'
        })] },
        contacts: { create: [expect.objectContaining({
          position: 1,
          firstName: 'María',
          phoneIndicative: '52',
          phoneExtension: '20'
        })] }
      }),
      update: expect.objectContaining({
        syncStatus: 'synced',
        requiresInvoice: true,
        syncVersion: { increment: 1 },
        updatedByEmail: 'vendedor@example.com',
        phones: {
          deleteMany: {},
          create: [expect.objectContaining({ position: 1, number: '5512345678' })]
        },
        contacts: {
          deleteMany: {},
          create: [expect.objectContaining({ position: 1, firstName: 'María' })]
        }
      })
    }))
    expect(upsert.mock.calls[0]?.[0].update).not.toHaveProperty('isCustomer')
    expect(upsert.mock.calls[0]?.[0].update).not.toHaveProperty('isSupplier')
  })

  it('excluye el domicilio del snapshot local del cliente', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined)
    const tx = { siigoCustomer: { upsert } } as unknown as Parameters<typeof upsertSiigoCustomer>[0]
    const customer: SiigoCustomer = {
      id: '6824bfe4-a93d-4eaa-aa88-95fea673b53b',
      name: ['ILEINN ELISABET', 'LOPEZ SAUCEDA'],
      address: {
        street: 'BOULEVARD (BLVD.) MANUEL J. CLOUTHIER',
        exterior_number: '22216',
        postal_code: '22214',
        city: { country_code: 'Mx', state_code: '02', city_code: '004' }
      }
    }

    await upsertSiigoCustomer(tx, customer, {
      rawPayload: customer
    })

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ rawPayload: expect.not.objectContaining({ address: expect.anything() }) }),
      update: expect.objectContaining({ rawPayload: expect.not.objectContaining({ address: expect.anything() }) })
    }))
    expect(upsert.mock.calls[0]?.[0].create).not.toHaveProperty('addressStreet')
    expect(upsert.mock.calls[0]?.[0].update).not.toHaveProperty('addressStreet')
  })
})
