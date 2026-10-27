import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { syncInvoiceProducts } from '../../server/utils/siigo-product-sync'

const mocks = vi.hoisted(() => ({ detail: vi.fn(), upsert: vi.fn(), archive: vi.fn() }))
vi.mock('../../server/utils/siigo-products', () => ({ getProductDetail: mocks.detail }))
vi.mock('../../server/utils/siigo-persistence', () => ({ upsertSiigoProduct: mocks.upsert }))
const db = { siigoProduct: { updateMany: mocks.archive } } as unknown as Parameters<typeof syncInvoiceProducts>[0]
const line = { productId: 'product-1', code: 'P001' }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.detail.mockResolvedValue({ id: line.productId, code: line.code, name: 'Pintura', type: 'Product', active: true })
})
describe('validación explícita de productos antes de facturar', () => {
  it('consulta una vez cada ID con lectura fresca y actualiza PostgreSQL', async () => {
    await syncInvoiceProducts(db, [line, line])
    expect(mocks.detail).toHaveBeenCalledExactlyOnceWith(line.productId, true)
    expect(mocks.upsert).toHaveBeenCalledWith(db, expect.objectContaining({ id: line.productId }))
  })
  it('bloquea la factura y desactiva localmente un producto eliminado en Siigo', async () => {
    mocks.detail.mockRejectedValue(createError({ statusCode: 404 }))
    await expect(syncInvoiceProducts(db, [line])).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.archive).toHaveBeenCalledWith({ where: { id: line.productId }, data: { active: false } })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it.each([{ active: false }, { code: 'OTRO' }, { type: 'Service' }])('sincroniza y bloquea productos no facturables: %j', async (changed) => {
    mocks.detail.mockResolvedValue({ id: line.productId, code: line.code, name: 'Pintura', type: 'Product', active: true, ...changed })
    await expect(syncInvoiceProducts(db, [line])).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.upsert).toHaveBeenCalledOnce()
  })
  it('no toma una falla temporal como eliminación de producto', async () => {
    mocks.detail.mockRejectedValue(createError({ statusCode: 503 }))
    await expect(syncInvoiceProducts(db, [line])).rejects.toMatchObject({ statusCode: 503 })
    expect(mocks.archive).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
})
