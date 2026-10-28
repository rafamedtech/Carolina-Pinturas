import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { productMutationInput } from '../../app/utils/siigoProductMutation'
import { saveManagedProduct } from '../../server/utils/managed-products'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(), update: vi.fn(), persist: vi.fn(), transaction: vi.fn(),
  current: vi.fn(), validate: vi.fn()
}))
vi.mock('../../server/utils/siigo-products', () => ({
  getProductDetail: mocks.current, mutateProduct: mocks.mutate,
  validateProductReferences: vi.fn(), listProducts: vi.fn()
}))
vi.mock('../../server/utils/siigo-persistence', () => ({ upsertSiigoProduct: mocks.persist, siigoJson: (value: unknown) => value }))
vi.mock('../../server/utils/product-compositions', () => ({
  validateComposition: mocks.validate, lockCompositions: vi.fn(),
  assertNoPendingProductWrites: vi.fn(), attachProductCompositions: vi.fn()
}))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({
  $transaction: mocks.transaction, productWrite: { update: mocks.update }
}) }))
const product = {
  id: '00000000-0000-4000-8000-000000000001', code: 'PIN-1', name: 'Pintura',
  type: 'Product', stock_control: false, account_group: { id: 10 }, key: { code: '31211500' }
}
const operationId = '00000000-0000-4000-8000-000000000002'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.update.mockResolvedValue({})
  mocks.transaction.mockImplementation(async callback => callback({
    productWrite: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: operationId, input: productMutationInput(product), isNew: true })
    }
  }))
})

describe('clasificación del resultado de un guardado de producto', () => {
  it.each([429, 502, 504])('cierra como failed un error %s que ocurrió antes de escribir en Siigo', async (statusCode) => {
    mocks.mutate.mockRejectedValue(createError({ statusCode, data: { ambiguous: false } }))
    await expect(saveManagedProduct(productMutationInput(product))).rejects.toMatchObject({ statusCode, data: { ambiguous: false } })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'failed' } })
    expect(mocks.mutate).toHaveBeenCalledTimes(1)
  })

  it.each([undefined, true])('conserva el bloqueo ante un fallo remoto incierto: %s', async (ambiguous) => {
    mocks.mutate.mockRejectedValue(createError({ statusCode: 504, data: { ambiguous } }))
    await expect(saveManagedProduct(productMutationInput(product))).rejects.toMatchObject({ statusCode: 502, data: { ambiguous: true } })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'unknown' } })
    expect(mocks.mutate).toHaveBeenCalledTimes(1)
  })

  it('mantiene pendiente un fallo local después de confirmar Siigo', async () => {
    mocks.mutate.mockResolvedValue(product)
    mocks.transaction.mockImplementationOnce(async callback => callback({
      productWrite: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: operationId, input: productMutationInput(product), isNew: true }) }
    })).mockRejectedValueOnce(createError({ statusCode: 409, data: { ambiguous: false } }))
    await expect(saveManagedProduct(productMutationInput(product))).rejects.toMatchObject({ data: { ambiguous: true } })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'unknown', productId: product.id } })
  })
})
