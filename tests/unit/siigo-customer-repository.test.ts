import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrisma } from '../../server/utils/prisma'
import {
  localCustomerInternal,
  withLocalCustomerInternals
} from '../../server/utils/siigo-customer-repository'

vi.mock('../../server/utils/prisma', () => ({ usePrisma: vi.fn() }))

describe('preferencias locales de clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it('conserva únicamente proveedores que también tienen tipo Supplier en PostgreSQL', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
      internalCode: null,
      internalNotes: null,
      internalTags: [],
      requiresInvoice: false,
      syncStatus: 'synced',
      syncVersion: 1,
      syncedAt: new Date('2026-08-31T17:00:00.000Z')
    }])
    vi.mocked(usePrisma).mockReturnValue({
      siigoCustomer: { findMany }
    } as unknown as ReturnType<typeof usePrisma>)

    const supplier = {
      id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
      name: ['Proveedor Uno'],
      type: 'Supplier'
    }
    const missingLocally = {
      id: 'a3279626-da6a-4eb8-a2ae-dc9e866470db',
      name: ['Proveedor Dos'],
      type: 'Supplier'
    }

    await expect(withLocalCustomerInternals(
      [supplier, missingLocally],
      { type: 'Supplier' }
    )).resolves.toEqual([expect.objectContaining({ id: supplier.id })])
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { in: [supplier.id, missingLocally.id] },
        type: { equals: 'Supplier', mode: 'insensitive' }
      }
    }))
  })
})
