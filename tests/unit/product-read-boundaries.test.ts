import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

const mocks = vi.hoisted(() => ({ db: { salesOrderSiigoInvoice: { findUnique: vi.fn() } }, sync: vi.fn(), products: vi.fn(), request: vi.fn(), customer: vi.fn() }))
const order = {
  requiresInvoice: true, status: { key: 'confirmado' }, number: 'PED-1', orderDate: '2026-10-26', total: 108,
  customer: { id: 'customer-1', name: 'Cliente', rfc: 'PIN900101AB1' }, items: [{ productId: 'product-1', code: 'P001' }]
}
vi.mock('../../server/utils/auth', () => ({ requireRole: async () => ({ role: 'admin' }) }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => mocks.db }))
vi.mock('../../server/utils/orders', () => ({ getOrder: async () => order }))
vi.mock('../../server/utils/siigo-product-sync', () => ({ syncInvoiceProducts: mocks.sync }))
vi.mock('../../server/utils/stored-products', () => ({ getStoredProducts: mocks.products }))
vi.mock('../../server/utils/siigo', () => ({ siigoRequest: mocks.request }))
vi.mock('../../server/utils/siigo-customer-detail', () => ({ getSiigoCustomerDetail: mocks.customer }))
vi.stubGlobal('eventHandler', (handler: unknown) => handler)
vi.stubGlobal('getQuery', (event: { query?: unknown }) => event.query ?? {})
vi.stubGlobal('getRouterParam', () => 'order-1')
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('createError', createError)
vi.mock('#app/nuxt', async importOriginal => ({ ...(await importOriginal<object>()), useRuntimeConfig: () => ({ siigo: { invoiceWritesEnabled: true } }) }))
const context = (await import('../../server/api/orders/[id]/siigo-invoice/context.get')).default
const prices = (await import('../../server/api/catalog/prices.get')).default
beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.salesOrderSiigoInvoice.findUnique.mockResolvedValue(null)
  // An incomplete customer returns before loading fiscal catalogs.
  mocks.customer.mockResolvedValue({ id: 'customer-1', active: false })
  mocks.products.mockResolvedValue([{ id: 'product-1', code: 'P001', name: 'Pintura local', active: true, prices: [{ currency_code: 'MXN', price_list: [{ position: 1, value: 108 }] }] }])
})
const event = (query: object = {}) => ({ query }) as Parameters<typeof context>[0]
describe('fronteras de lectura y sincronización de productos', () => {
  it('el contexto automático del pedido no sincroniza productos', async () => {
    await context(event())
    expect(mocks.sync).not.toHaveBeenCalled()
  })
  it('Facturar solicita una validación fresca solo para las partidas del pedido', async () => {
    await context(event({ validate_products: 'true' }))
    expect(mocks.sync).toHaveBeenCalledExactlyOnceWith(mocks.db, order.items)
  })
  it('rechaza el contexto de facturación si la validación de productos falla', async () => {
    mocks.sync.mockRejectedValueOnce(createError({ statusCode: 409 }))
    await expect(context(event({ validate_products: 'true' }))).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.customer).not.toHaveBeenCalled()
  })
  it('el catálogo público de precios solo lee PostgreSQL y conserva los importes guardados', async () => {
    const result = await prices(event())
    expect(result.products).toEqual([expect.objectContaining({ code: 'P001', price: 108, currency: 'MXN' })])
    expect(mocks.products).toHaveBeenCalledWith(mocks.db)
    expect(mocks.request).not.toHaveBeenCalled()
  })
})
