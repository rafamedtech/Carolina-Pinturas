import { describe, expect, it, vi } from 'vitest'
import { getCompleteSiigoCustomerCatalog } from '../../server/utils/siigo-customer-catalog-view'

const mocks = vi.hoisted(() => ({ getAll: vi.fn(), prisma: vi.fn() }))
vi.mock('../../server/utils/siigo-customer-catalog', () => ({ getAllSiigoCustomers: mocks.getAll }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: mocks.prisma }))

describe('regresión de proveedor oculto por membresías locales desactualizadas', () => {
  it.each(['Customer', 'Supplier'])('repara el snapshot %s antes de filtrar y conserva ambos catálogos', async (type) => {
    // Caso reportado el 2026-09-08; datos simulados, sin llamadas al tenant.
    const supplier = {
      id: '00000000-0000-4000-8000-000000000001',
      name: ['UNIVERSAL PAINT DEL NOROESTE, S. DE R.L. DE C.V.'],
      type: 'Supplier'
    }
    let local = {
      id: supplier.id,
      type,
      isCustomer: true,
      isSupplier: false,
      internalCode: 'PROV-001',
      internalNotes: 'Conservar preferencias',
      internalTags: ['mayoreo'],
      isInternalOrderCustomer: false,
      requiresInvoice: true,
      syncStatus: 'synced',
      syncVersion: 1,
      syncedAt: new Date('2026-09-08T00:00:00Z')
    }
    const upsert = vi.fn(async ({ update }) => {
      local = { ...local, ...update, syncVersion: local.syncVersion + 1 }
      return local
    })
    const db = {
      siigoCustomer: {
        findMany: vi.fn(async ({ where }) => (
          (where.isSupplier && !local.isSupplier) || (where.isCustomer && !local.isCustomer)
            ? []
            : [local]
        )),
        upsert
      }
    }
    mocks.prisma.mockReturnValue({
      ...db,
      $transaction: async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)
    })
    mocks.getAll.mockResolvedValue({
      results: [supplier],
      pagination: { page: 1, page_size: 100, total_results: 1 }
    })

    const suppliers = await getCompleteSiigoCustomerCatalog({ customerType: 'Supplier' })
    const customers = await getCompleteSiigoCustomerCatalog({ customerType: 'Customer' })

    expect(suppliers.results).toHaveLength(1)
    expect(suppliers.results[0]).toMatchObject({
      ...supplier,
      internal: {
        roles: { customer: true, supplier: true },
        code: 'PROV-001',
        notes: 'Conservar preferencias',
        requires_invoice: true
      }
    })
    expect(customers.results.map(customer => customer.id)).toEqual([supplier.id])
    expect(suppliers.pagination?.total_results).toBe(1)
    // Una segunda carga no vuelve a escribir un registro ya reparado.
    expect(upsert).toHaveBeenCalledOnce()
  })
})
