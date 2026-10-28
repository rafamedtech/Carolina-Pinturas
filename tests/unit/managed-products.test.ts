import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'
import { productMutationInput } from '../../app/utils/siigoProductMutation'
import { discardProductWrite, recoverProductWrite, reviewProductWrite, retryProductWrite, saveManagedProduct } from '../../server/utils/managed-products'

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(), list: vi.fn(), localUpdate: vi.fn(), update: vi.fn(), persist: vi.fn(), transaction: vi.fn(),
  current: vi.fn(), validate: vi.fn(), findWrite: vi.fn(), lock: vi.fn(), findPending: vi.fn(), attach: vi.fn(), stored: vi.fn(), localVersion: vi.fn()
}))
vi.mock('../../server/utils/siigo-products', () => ({
  getProductDetail: mocks.current, mutateProduct: mocks.mutate,
  validateProductReferences: vi.fn(), listProducts: mocks.list
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

describe('guardado local condicionado a la confirmación de Siigo', () => {
  const previous = { ...product, name: 'Anterior', stock_control: true }
  const confirmed = { ...product, name: 'Nuevo nombre' }
  const input = productMutationInput(confirmed)
  const tx = () => ({
    $queryRaw: vi.fn().mockResolvedValue([{ state: 'pending' }]),
    siigoProduct: { findUnique: vi.fn().mockResolvedValue({ internalKind: 'product' }), update: mocks.localUpdate },
    productWrite: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: operationId, ...data })),
      update: mocks.update
    }
  })
  beforeEach(() => {
    mocks.transaction.mockImplementation(async callback => callback(tx()))
    mocks.current.mockResolvedValueOnce(previous).mockResolvedValue(confirmed)
    mocks.mutate.mockResolvedValue(confirmed)
  })
  it('escribe en Siigo, comprueba por ID y después guarda el snapshot y las opciones internas', async () => {
    mocks.persist.mockImplementation(async () => {
      expect(mocks.mutate).toHaveBeenCalledTimes(1)
      expect(mocks.current).toHaveBeenCalledTimes(2)
    })
    expect(await saveManagedProduct(input, product.id)).toMatchObject(confirmed)
    expect(mocks.current).toHaveBeenLastCalledWith(product.id, true)
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'synced', productId: product.id } })
    expect(mocks.localUpdate).toHaveBeenCalledTimes(1)
  })
  it.each([400, 429, 502, 504])('un error remoto %s falla localmente sin modificar el producto ni bloquear el reintento', async (statusCode) => {
    mocks.mutate.mockRejectedValue(createError({ statusCode, data: { ambiguous: true } }))
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ statusCode, data: { ambiguous: false, retryable: true } })
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.localUpdate).not.toHaveBeenCalled()
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: operationId }, data: { state: 'failed', productId: product.id } })
  })
  it('un HTTP exitoso con datos anteriores no aplica ningún cambio local', async () => {
    mocks.current.mockReset().mockResolvedValue(previous)
    mocks.mutate.mockResolvedValue(previous)
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { retryable: true, cause: { message: 'Siigo todavía no confirma todos los cambios enviados.' } } })
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.localUpdate).not.toHaveBeenCalled()
  })
  it('la comprobación final detecta que falta desactivar el inventario aunque el resto coincida', async () => {
    mocks.current.mockReset().mockResolvedValueOnce(previous).mockResolvedValue({ ...confirmed, stock_control: true })
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { retryable: true } })
    expect(mocks.persist).not.toHaveBeenCalled()
  })
  it.each(['unavailable', 'other-id', 'partial'])('no guarda localmente si la lectura final devuelve %s', async (result) => {
    mocks.current.mockReset().mockResolvedValueOnce(previous)
    if (result === 'unavailable') mocks.current.mockRejectedValueOnce(createError({ statusCode: 502 }))
    else mocks.current.mockResolvedValueOnce({ ...confirmed, ...(result === 'other-id' ? { id: 'otro' } : { name: 'Cambio parcial' }) })
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { retryable: true } })
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.localUpdate).not.toHaveBeenCalled()
  })
  it('un reintento manual después del fallo vuelve a enviar y solo confirma localmente al coincidir Siigo', async () => {
    mocks.current.mockReset().mockResolvedValueOnce(previous).mockResolvedValueOnce(previous).mockResolvedValueOnce(confirmed)
    mocks.mutate.mockRejectedValueOnce(createError({ statusCode: 502 })).mockResolvedValueOnce(confirmed)
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { retryable: true } })
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(await saveManagedProduct(input, product.id)).toMatchObject(confirmed)
    expect(mocks.mutate).toHaveBeenCalledTimes(2)
    expect(mocks.localUpdate).toHaveBeenCalledTimes(1)
  })
  it('si la respuesta se perdió pero Siigo ya refleja los cambios, el reintento no repite el PUT', async () => {
    mocks.current.mockReset().mockResolvedValue(confirmed)
    expect(await saveManagedProduct(input, product.id)).toMatchObject(confirmed)
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.localUpdate).toHaveBeenCalledTimes(1)
  })
  it('un fallo del commit local permite volver a guardar sin repetir el PUT confirmado', async () => {
    mocks.transaction.mockImplementationOnce(async callback => callback(tx())).mockRejectedValueOnce(new Error('Fallo local'))
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { retryable: true, cause: { stage: 'local' } } })
    expect(mocks.localUpdate).not.toHaveBeenCalled()
    expect(await saveManagedProduct(input, product.id)).toMatchObject(confirmed)
    expect(mocks.mutate).toHaveBeenCalledTimes(1)
  })
  it('si la base de datos no puede cerrar el intento, conserva la reserva e informa que hay que comprobarlo', async () => {
    mocks.mutate.mockRejectedValue(createError({ statusCode: 502 }))
    mocks.update.mockRejectedValue(new Error('Base de datos no disponible'))
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { retryable: false, ambiguous: true } })
    expect(mocks.persist).not.toHaveBeenCalled()
  })
  it('un fallo de consulta antes de escribir permite reintentar sin aplicar cambios locales', async () => {
    mocks.current.mockReset().mockRejectedValue(createError({ statusCode: 502, statusMessage: 'Siigo no está disponible.' }))
    await expect(saveManagedProduct(input, product.id)).rejects.toMatchObject({ data: { retryable: true, ambiguous: false } })
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it('un alta se confirma por ID antes de crear el producto local', async () => {
    mocks.current.mockReset().mockResolvedValue(confirmed)
    expect(await saveManagedProduct(input)).toMatchObject(confirmed)
    expect(mocks.mutate).toHaveBeenCalledWith(input, undefined)
    expect(mocks.current).toHaveBeenCalledWith(confirmed.id, true)
  })
  it('un alta fallida no crea el producto local', async () => {
    mocks.mutate.mockRejectedValue(createError({ statusCode: 504 }))
    await expect(saveManagedProduct(input)).rejects.toMatchObject({ data: { retryable: true } })
    expect(mocks.persist).not.toHaveBeenCalled()
    expect(mocks.localUpdate).not.toHaveBeenCalled()
  })
  it('un reintento de alta localiza por código el producto creado tras perder la respuesta, sin otro POST', async () => {
    mocks.findPending.mockResolvedValue({ productId: null, code: input.code })
    mocks.list.mockResolvedValue({ results: [confirmed] })
    mocks.current.mockReset().mockResolvedValue(confirmed)
    expect(await saveManagedProduct(input)).toMatchObject(confirmed)
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ code: input.code, refresh: 'true' }))
    expect(mocks.mutate).not.toHaveBeenCalled()
  })
  it('un reintento de alta conserva el bloqueo de código duplicado si Siigo tiene datos distintos', async () => {
    mocks.findPending.mockResolvedValue({ productId: null, code: input.code })
    mocks.list.mockResolvedValue({ results: [previous] })
    await expect(saveManagedProduct(input)).rejects.toMatchObject({ statusCode: 409 })
    expect(mocks.mutate).not.toHaveBeenCalled()
    expect(mocks.persist).not.toHaveBeenCalled()
  })
})
