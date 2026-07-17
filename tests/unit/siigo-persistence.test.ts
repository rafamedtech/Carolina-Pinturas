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
      rfc_id: 'LOMA850101AB1',
      phones: [{ number: '5512345678' }],
      contacts: [{ first_name: 'María', last_name: 'López', email: 'maria@example.com' }]
    }

    await upsertSiigoCustomer(tx, customer)

    expect(upsert).toHaveBeenCalledOnce()
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        phones: { create: [expect.objectContaining({ position: 1, number: '5512345678' })] },
        contacts: { create: [expect.objectContaining({ position: 1, firstName: 'María' })] }
      }),
      update: expect.objectContaining({
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
  })
})
