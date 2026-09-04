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
      isCustomer: true,
      isSupplier: true,
      isInternalOrderCustomer: true,
      requiresInvoice: true,
      syncStatus: 'synced',
      syncVersion: 3,
      syncedAt: new Date('2026-08-18T17:00:00.000Z')
    })

    expect(internal).toEqual({
      code: 'CLI-001',
      notes: 'Cuenta de mayoreo',
      tags: ['mayoreo'],
      roles: { customer: true, supplier: true },
      internal_orders: true,
      requires_invoice: true,
      sync_status: 'synced',
      sync_version: 3,
      synced_at: '2026-08-18T17:00:00.000Z'
    })
    expect(internal).not.toHaveProperty('address')
    expect(internal).not.toHaveProperty('rfc_id')
  })

  it('conserva únicamente terceros con el rol local Supplier', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
      internalCode: null,
      internalNotes: null,
      internalTags: [],
      isCustomer: true,
      isSupplier: true,
      isInternalOrderCustomer: false,
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
      { role: 'Supplier' }
    )).resolves.toEqual([expect.objectContaining({ id: supplier.id })])
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: { in: [supplier.id, missingLocally.id] },
        isSupplier: true
      }
    }))
  })

  it('incluye un tercero con ambos roles en los dos catálogos y uno exclusivo solo en el suyo', async () => {
    const dualId = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'
    const customerId = 'a3279626-da6a-4eb8-a2ae-dc9e866470db'
    const row = (id: string, customer: boolean, supplier: boolean) => ({
      id,
      internalCode: null,
      internalNotes: null,
      internalTags: [],
      isCustomer: customer,
      isSupplier: supplier,
      isInternalOrderCustomer: false,
      requiresInvoice: false,
      syncStatus: 'synced',
      syncVersion: 1,
      syncedAt: new Date('2026-08-31T17:00:00.000Z')
    })
    const findMany = vi.fn().mockImplementation(({ where }) => Promise.resolve(
      where.isSupplier
        ? [row(dualId, true, true)]
        : [row(dualId, true, true), row(customerId, true, false)]
    ))
    vi.mocked(usePrisma).mockReturnValue({
      siigoCustomer: { findMany }
    } as unknown as ReturnType<typeof usePrisma>)
    const customers = [
      { id: dualId, name: ['Ambos roles'], type: 'Supplier' },
      { id: customerId, name: ['Solo cliente'], type: 'Customer' }
    ]

    const customerCatalog = await withLocalCustomerInternals(customers, { role: 'Customer' })
    const supplierCatalog = await withLocalCustomerInternals(customers, { role: 'Supplier' })

    expect(customerCatalog.map(customer => customer.id)).toEqual([dualId, customerId])
    expect(supplierCatalog.map(customer => customer.id)).toEqual([dualId])
  })
})
