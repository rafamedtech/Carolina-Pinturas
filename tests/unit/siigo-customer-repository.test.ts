import { describe, expect, it, vi } from 'vitest'
import { localCustomerInternal } from '../../server/utils/siigo-customer-repository'

vi.mock('../../server/utils/prisma', () => ({ usePrisma: vi.fn() }))

describe('preferencias locales de clientes', () => {
  it('expone únicamente los campos internos que se agregan al cliente de Siigo', () => {
    const internal = localCustomerInternal({
      id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
      internalCode: 'CLI-001',
      internalNotes: 'Cuenta de mayoreo',
      internalTags: ['mayoreo'],
      requiresInvoice: true,
      syncStatus: 'synced',
      syncVersion: 3,
      syncedAt: new Date('2026-08-18T17:00:00.000Z')
    })

    expect(internal).toEqual({
      code: 'CLI-001',
      notes: 'Cuenta de mayoreo',
      tags: ['mayoreo'],
      requires_invoice: true,
      sync_status: 'synced',
      sync_version: 3,
      synced_at: '2026-08-18T17:00:00.000Z'
    })
    expect(internal).not.toHaveProperty('address')
    expect(internal).not.toHaveProperty('rfc_id')
  })
})
