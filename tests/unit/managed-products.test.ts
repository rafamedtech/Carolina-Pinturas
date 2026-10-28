import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { productMutationInput } from '../../app/utils/siigoProductMutation'
import { discardProductWrite, recoverProductWrite, reviewProductWrite, retryProductWrite, saveManagedProduct } from '../../server/utils/managed-products'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(), update: vi.fn(), persist: vi.fn(), transaction: vi.fn(),
  current: vi.fn(), validate: vi.fn(), findWrite: vi.fn(), lock: vi.fn(), findPending: vi.fn(), attach: vi.fn(), stored: vi.fn(), localVersion: vi.fn()
}))
vi.mock('../../server/utils/siigo-products', () => ({
  getProductDetail: mocks.current, mutateProduct: mocks.mutate,
  validateProductReferences: vi.fn(), listProducts: vi.fn()
}))
vi.mock('../../server/utils/siigo-persistence', () => ({ upsertSiigoProduct: mocks.persist, siigoJson: (value: unknown) => value }))
vi.mock('../../server/utils/product-compositions', () => ({
  validateComposition: mocks.validate, lockCompositions: vi.fn(),
  assertNoPendingProductWrites: vi.fn(), attachProductCompositions: mocks.attach
}))
vi.mock('../../server/utils/stored-products', () => ({ getStoredProduct: mocks.stored }))
vi.mock('../../server/utils/prisma', () => ({ usePrisma: () => ({
  $transaction: mocks.transaction, productWrite: { update: mocks.update, findUniqueOrThrow: mocks.findWrite, findFirst: mocks.findPending }, siigoProduct: { findUnique: mocks.localVersion }
}) }))
const product = {
  id: '00000000-0000-4000-8000-000000000001', code: 'PIN-1', name: 'Pintura',
  type: 'Product', stock_control: false, account_group: { id: 10 }, key: { code: '31211500' }
}
const operationId = '00000000-0000-4000-8000-000000000002'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.update.mockResolvedValue({})
  mocks.findPending.mockResolvedValue(null)
  mocks.localVersion.mockResolvedValue({ compositionVersion: 1 })
  mocks.attach.mockImplementation(async (_db, products) => products)
  mocks.transaction.mockImplementation(async callback => callback({
    productWrite: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: operationId, input: productMutationInput(product), isNew: true })
    }
  }))
})

describe('revisión del guardado sin reescribir Siigo', () => {
  const oldDate = new Date('2026-01-01T00:00:00Z')
  beforeEach(() => {
    mocks.findWrite.mockResolvedValue({ id: operationId, code: product.code, productId: product.id, isNew: false, state: 'unknown', updatedAt: oldDate, input: productMutationInput(product) })
    mocks.current.mockResolvedValue(product)
    mocks.transaction.mockImplementation(async callback => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ state: 'unknown' }]),
      siigoProduct: { findUnique: vi.fn().mockResolvedValue({ internalKind: 'product' }), update: vi.fn() },
      productWrite: { update: mocks.update }
    }))
  })
  it('completa automáticamente solo el commit local cuando Siigo ya coincide', async () => {
    expect(await reviewProductWrite(operationId)).toMatchObject({ status: 'synced', product })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'synced', productId: product.id } })
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('devuelve comparación, borrador y acciones para diferencias de una edición antigua', async () => {
    mocks.current.mockResolvedValue({ ...product, name: 'Anterior' })
    expect(await reviewProductWrite(operationId)).toMatchObject({
      status: 'different', input: productMutationInput(product), canRetry: true, canDiscard: true,
      differences: [{ field: 'name', expected: product.name, actual: 'Anterior' }]
    })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.current).toHaveBeenCalledTimes(1)
  })
  it('conserva el borrador durante una caída y no habilita escrituras ni cierres', async () => {
    mocks.current.mockRejectedValue(createError({ statusCode: 503, statusMessage: 'Siigo no está disponible' }))
    expect(await reviewProductWrite(operationId)).toMatchObject({ status: 'unavailable', input: productMutationInput(product), canRetry: false, canDiscard: false })
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('explica el bloqueo de un intento reciente y de una creación incierta', async () => {
    mocks.current.mockResolvedValue({ ...product, name: 'Anterior' })
    mocks.findWrite.mockResolvedValue({ id: operationId, productId: product.id, isNew: false, state: 'unknown', updatedAt: new Date(), input: productMutationInput(product) })
    expect(await reviewProductWrite(operationId)).toMatchObject({ status: 'different', canRetry: false, canDiscard: false })
    mocks.findWrite.mockResolvedValue({ id: operationId, productId: product.id, isNew: true, state: 'unknown', updatedAt: oldDate, input: productMutationInput(product) })
    expect(await reviewProductWrite(operationId)).toMatchObject({ status: 'different', isNew: true, canRetry: false, canDiscard: false })
  })
  it('permite corregir después de un fallo local sin reescribir datos confirmados', async () => {
    mocks.transaction.mockRejectedValue(createError({ statusCode: 409, statusMessage: 'El producto cambió. Recarga antes de guardar.' }))
    expect(await reviewProductWrite(operationId)).toMatchObject({ status: 'local_error', canRetry: false, canDiscard: true })
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('sigue al reemplazo real si se perdió la respuesta del reenvío', async () => {
    const replacement = '00000000-0000-4000-8000-000000000003'
    mocks.findWrite.mockResolvedValueOnce({ id: operationId, code: product.code, productId: product.id, isNew: false, state: 'failed', updatedAt: oldDate, input: productMutationInput(product) })
    mocks.findPending.mockResolvedValue({ id: replacement })
    mocks.current.mockResolvedValue({ ...product, name: 'Anterior' })
    expect(await reviewProductWrite(operationId)).toMatchObject({ status: 'different', operationId: replacement })
    expect(mocks.findWrite).toHaveBeenCalledWith({ where: { id: replacement } })
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('un reenvío explícito primero comprueba y evita el PUT si los datos ya coinciden', async () => {
    expect(await retryProductWrite(operationId)).toMatchObject(product)
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('rechaza otro reenvío cuando el intento ya se cerró', async () => {
    mocks.findWrite.mockResolvedValue({ isNew: false, productId: product.id, state: 'failed' })
    await expect(retryProductWrite(operationId)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.current).not.toHaveBeenCalled()
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
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

describe('restauración de una edición fallida sin cambios en Siigo', () => {
  const previous = { ...product, stock_control: true, name: 'Anterior' }
  const input = { ...productMutationInput(previous), name: 'Nuevo nombre' }
  beforeEach(() => {
    mocks.current.mockResolvedValue(previous)
    mocks.mutate.mockRejectedValue(createError({ statusCode: 502, data: { ambiguous: true, cause: { statusCode: 502, message: 'Servicio no disponible' } } }))
    mocks.transaction.mockImplementation(async callback => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ state: 'unknown' }]),
      productWrite: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(async ({ data }) => ({ id: operationId, ...data })),
        update: mocks.update
      }
    }))
  })
  it('cierra el intento, conserva el inventario anterior y devuelve el producto para restaurar el formulario', async () => {
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({
      statusCode: 502, data: { ambiguous: false, restoredProduct: previous }
    })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'failed' } })
    expect(mocks.mutate).toHaveBeenCalledTimes(1)
    expect(mocks.current).toHaveBeenCalledTimes(2)
    expect(mocks.validate).toHaveBeenCalledTimes(1)
  })
  it.each(['changed', 'unavailable', 'other-id'])('mantiene pendiente si la verificación devuelve %s', async (result) => {
    mocks.current.mockReset().mockResolvedValueOnce(previous)
    if (result === 'unavailable') mocks.current.mockRejectedValueOnce(createError({ statusCode: 502 }))
    else mocks.current.mockResolvedValueOnce({ ...previous, ...(result === 'changed' ? { name: 'Cambio parcial' } : { id: 'otro' }) })
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { ambiguous: true } })
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'unknown' } })
  })
  it('no desbloquea si falla el cierre local', async () => {
    mocks.transaction.mockImplementationOnce(async callback => callback({
      productWrite: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: operationId }) }
    })).mockRejectedValueOnce(new Error('Base de datos no disponible'))
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { ambiguous: true } })
  })
  it('espera antes de cerrar un timeout que todavía podría procesarse en Siigo', async () => {
    mocks.mutate.mockRejectedValue(createError({ statusCode: 504, data: { ambiguous: true } }))
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { ambiguous: true } })
    expect(mocks.current).toHaveBeenCalledTimes(1)
  })
  it('la revisión posterior restaura un timeout antiguo únicamente si coincide con el snapshot anterior', async () => {
    // Snapshot stored with the failed intent, using the actual remote stock_control.
    const { composition: _composition, availability: _availability, ...commercial } = productMutationInput(previous)
    const previousCommercial = Object.fromEntries(Object.entries({ ...commercial, stock_control: true, taxes: [], prices: [] }).reverse())
    mocks.findWrite.mockResolvedValue({ id: operationId, productId: product.id, isNew: false, state: 'unknown', updatedAt: new Date('2026-01-01'), input: { ...input, previousCommercial } })
    expect(await reviewProductWrite(operationId)).toMatchObject({ status: 'reverted', product: previous })
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'failed' } })
  })
})
