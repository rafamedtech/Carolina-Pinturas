import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppUser, SiigoProduct } from '../../app/types/siigo'

const mocks = vi.hoisted(() => ({
  db: {} as Record<string, unknown>,
  supplier: vi.fn(),
  product: vi.fn(),
  snapshot: vi.fn(),
  transaction: vi.fn()
}))

vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => mocks.db }))
vi.mock('../../server/utils/siigo-customer-detail', () => ({ getSiigoCustomerDetail: mocks.supplier }))
vi.mock('../../server/utils/siigo-products', () => ({ getProductDetail: mocks.product }))
vi.mock('../../server/utils/siigo-persistence', () => ({ upsertSiigoProduct: mocks.snapshot }))

const { mutatePurchase } = await import('../../server/utils/purchases')

describe('compras: límite de la transacción', () => {
  const orderId = randomUUID()
  const providerId = randomUUID()
  const productId = randomUUID()
  const itemId = randomUUID()
  const user: AppUser = {
    id: randomUUID(),
    name: 'Administración',
    email: 'admin@example.test',
    role: 'admin',
    repartidorId: null
  }
  const product: SiigoProduct = {
    id: productId,
    code: 'P-1',
    name: 'Pintura',
    active: true,
    prices: [],
    taxes: [],
    warehouses: [],
    components: []
  }
  const row = {
    id: orderId,
    folio: 1,
    status: 'borrador',
    version: 1,
    providerId,
    providerName: 'Proveedor',
    providerRfc: null,
    providerPayload: {},
    date: new Date('2026-09-22T00:00:00Z'),
    currencyCode: 'MXN',
    total: { toString: () => '10' },
    notes: '',
    createdBy: user.email,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [{
      id: itemId,
      orderId,
      productId,
      position: 0,
      code: product.code,
      name: product.name,
      productPayload: {},
      quantity: { toString: () => '1' },
      unitCost: { toString: () => '10' },
      total: { toString: () => '10' }
    }],
    receipts: [],
    invoices: [],
    events: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const tx = {
      purchaseOrder: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(row),
        update: vi.fn().mockResolvedValue(row)
      },
      purchaseItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      purchaseEvent: { create: vi.fn().mockResolvedValue({}) }
    }
    mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    mocks.db = {
      siigoCustomer: { findUnique: vi.fn().mockResolvedValue({ isSupplier: true, active: true }) },
      purchaseEvent: { findUnique: vi.fn().mockResolvedValue(null) },
      purchaseOrder: { findUnique: vi.fn().mockResolvedValue(row) },
      $transaction: mocks.transaction
    }
    mocks.supplier.mockResolvedValue({ id: providerId, name: ['Proveedor'], type: 'Supplier', active: true })
    mocks.product.mockResolvedValue(product)
    mocks.snapshot.mockResolvedValue(undefined)
  })

  it('sincroniza snapshots antes de abrir la transacción que reemplaza las partidas', async () => {
    const result = await mutatePurchase(orderId, {
      requestId: randomUUID(),
      version: 1,
      command: {
        action: 'edit',
        draft: {
          providerId,
          date: '2026-09-22',
          currencyCode: 'MXN',
          notes: 'Actualizada',
          items: [{ productId, quantity: 1, unitCost: 10 }]
        }
      }
    }, user)

    expect(result.id).toBe(orderId)
    expect(mocks.snapshot).toHaveBeenCalledWith(mocks.db, product)
    expect(mocks.snapshot.mock.invocationCallOrder[0]).toBeLessThan(mocks.transaction.mock.invocationCallOrder[0]!)
  })
})
