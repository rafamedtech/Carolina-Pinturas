import { describe, expect, it, vi } from 'vitest'
import { localCustomerView } from '../../server/utils/siigo-customer-repository'

vi.mock('../../server/utils/prisma', () => ({ usePrisma: vi.fn() }))

describe('catálogo local de clientes', () => {
  it('reconstruye la vista compatible con Siigo y agrega los campos internos', () => {
    const customer = localCustomerView({
      id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
      displayName: 'Pinturas Centro',
      rawPayload: {
        id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
        name: 'Pinturas Centro',
        rfc_id: 'PIN900101AB1',
        phones: { number: '5512345678' }
      },
      internalCode: 'CLI-001',
      internalNotes: 'Cuenta de mayoreo',
      internalTags: ['mayoreo'],
      requiresInvoice: true,
      syncStatus: 'synced',
      syncVersion: 3,
      siigoCreatedAt: new Date('2025-03-10T18:30:00.000Z'),
      siigoUpdatedAt: null,
      syncedAt: new Date('2026-08-18T17:00:00.000Z')
    })

    expect(customer).toMatchObject({
      id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
      name: ['Pinturas Centro'],
      rfc_id: 'PIN900101AB1',
      phones: [{ number: '5512345678' }],
      metadata: {
        created: '2025-03-10T18:30:00.000Z',
        last_updated: null
      },
      internal: {
        code: 'CLI-001',
        notes: 'Cuenta de mayoreo',
        tags: ['mayoreo'],
        requires_invoice: true,
        sync_status: 'synced',
        sync_version: 3,
        synced_at: '2026-08-18T17:00:00.000Z'
      }
    })
  })
})
