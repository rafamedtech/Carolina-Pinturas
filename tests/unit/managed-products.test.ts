import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { productMutationInput } from '../../app/utils/siigoProductMutation'
import { discardProductWrite, recoverProductWrite, saveManagedProduct } from '../../server/utils/managed-products'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(), update: vi.fn(), persist: vi.fn(), transaction: vi.fn(),
  current: vi.fn(), validate: vi.fn(), findWrite: vi.fn(), lock: vi.fn()
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
  $transaction: mocks.transaction, productWrite: { update: mocks.update, findUniqueOrThrow: mocks.findWrite }
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

describe('desbloqueo explícito de ediciones pendientes', () => {
  const oldDate = new Date('2026-01-01T00:00:00Z')
  beforeEach(() => {
    mocks.findWrite.mockResolvedValue({ id: operationId, productId: product.id, isNew: false, state: 'unknown', updatedAt: oldDate })
    mocks.current.mockResolvedValue(product)
    mocks.lock.mockResolvedValue([{ state: 'unknown', updatedAt: oldDate }])
    mocks.transaction.mockImplementation(async callback => callback({ $queryRaw: mocks.lock, productWrite: { update: mocks.update } }))
  })

  it('consulta Siigo, conserva el snapshot actual y cierra solo el intento sin repetir la mutación', async () => {
    await expect(discardProductWrite(operationId, product.id)).resolves.toEqual({ productId: product.id })
    expect(mocks.current).toHaveBeenCalledWith(product.id, true)
    expect(mocks.persist).toHaveBeenCalledWith(expect.anything(), product)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'failed' } })
    expect(mocks.validate).not.toHaveBeenCalled()
    expect(mocks.mutate).not.toHaveBeenCalled()
  })

  it.each([{ isNew: true }, { productId: 'otro' }, { updatedAt: new Date() }])('rechaza altas, otro producto e intentos recientes: %j', async (change) => {
    mocks.findWrite.mockResolvedValue({ productId: product.id, isNew: false, updatedAt: oldDate, ...change })
    await expect(discardProductWrite(operationId, product.id)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.current).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it.each([{ state: 'synced', updatedAt: oldDate }, { state: 'unknown', updatedAt: new Date() }])('revalida el estado bajo bloqueo: %j', async (change) => {
    mocks.lock.mockResolvedValue([change])
    await expect(discardProductWrite(operationId, product.id)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('no desbloquea si no puede consultar el producto actual', async () => {
    mocks.current.mockRejectedValue(createError({ statusCode: 502 }))
    await expect(discardProductWrite(operationId, product.id)).rejects.toMatchObject({ statusCode: 502 })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('no aplica un intento descartado al volver a conciliar', async () => {
    mocks.findWrite.mockResolvedValue({ state: 'failed' })
    await expect(recoverProductWrite(operationId)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.current).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('identifica los campos que Siigo no refleja sin alterar ni reenviar el intento', async () => {
    mocks.findWrite.mockResolvedValue({ id: operationId, productId: product.id, state: 'unknown', input: productMutationInput(product) })
    mocks.current.mockResolvedValue({ ...product, stock_control: true, name: 'Nombre anterior' })
    await expect(recoverProductWrite(operationId)).rejects.toMatchObject({
      statusCode: 409, data: { operationId, differences: [
        { field: 'name', expected: 'Pintura', actual: 'Nombre anterior' },
        { field: 'stock_control', expected: false, actual: true }
      ] }
    })
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
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
