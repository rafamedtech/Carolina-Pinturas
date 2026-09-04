import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiigoCustomer } from '../../app/types/siigo'
import { getCompleteSiigoCustomerCatalog } from '../../server/utils/siigo-customer-catalog-view'

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  synchronize: vi.fn(),
  withInternals: vi.fn(),
  invalidate: vi.fn()
}))

vi.mock('../../server/utils/siigo-catalog', () => ({
  invalidateSiigoCatalog: mocks.invalidate
}))
vi.mock('../../server/utils/siigo-customer-catalog', () => ({
  getAllSiigoCustomers: mocks.getAll
}))
vi.mock('../../server/utils/siigo-customer-import', () => ({
  synchronizeSiigoCustomerSubset: mocks.synchronize
}))
vi.mock('../../server/utils/siigo-customer-repository', () => ({
  withLocalCustomerInternals: mocks.withInternals
}))

const dualRoleSupplier: SiigoCustomer = {
  id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
  name: ['PROVEEDORA DE MATERIAL DE COBRE'],
  type: 'Supplier',
  active: true
}

describe('catálogo completo de clientes Siigo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAll.mockResolvedValue({
      results: [dualRoleSupplier],
      pagination: { page: 1, page_size: 100, total_results: 1 }
    })
    mocks.synchronize.mockResolvedValue(1)
    mocks.withInternals.mockResolvedValue([dualRoleSupplier])
  })

  it('persiste todos los terceros antes de devolver el catálogo sin filtro de rol', async () => {
    await expect(getCompleteSiigoCustomerCatalog()).resolves.toEqual(expect.objectContaining({
      results: [dualRoleSupplier]
    }))

    expect(mocks.synchronize).toHaveBeenCalledWith([dualRoleSupplier])
    expect(mocks.withInternals).toHaveBeenCalledWith([dualRoleSupplier], undefined)
  })

  it('conserva el filtro local solicitado después de sincronizar todo el catálogo', async () => {
    await getCompleteSiigoCustomerCatalog({ customerType: 'Customer' })

    expect(mocks.synchronize).toHaveBeenCalledWith([dualRoleSupplier])
    expect(mocks.withInternals).toHaveBeenCalledWith([dualRoleSupplier], { role: 'Customer' })
  })
})
