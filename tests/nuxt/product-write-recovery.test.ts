// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, shallowRef, type EffectScope } from 'vue'
import { useProductWriteRecovery } from '~/composables/useProductWriteRecovery'
import { productMutationInput } from '~/utils/siigoProductMutation'
import type { ProductWriteReview } from '~/types/siigo-products'

const id = '00000000-0000-4000-8000-000000000001'
const nextId = '00000000-0000-4000-8000-000000000002'
const product = { id, code: 'PIN1', name: 'Pintura', type: 'Product', stock_control: false, key: { code: '31211500' }, account_group: { id: 10 } }
const input = productMutationInput(product)
const different: ProductWriteReview = {
  status: 'different', operationId: id, productId: id, input, isNew: false, componentLabels: {},
  differences: [{ field: 'name', expected: product.name, actual: 'Anterior' }],
  availableAt: '2026-01-01T00:00:00Z', canRetry: true, canDiscard: true, message: 'Revisa los cambios'
}
let scope: EffectScope | undefined
let originalFetch: typeof $fetch
const fetchMock = vi.fn()
beforeEach(() => {
  originalFetch = globalThis.$fetch
  globalThis.$fetch = fetchMock as unknown as typeof $fetch
  fetchMock.mockReset()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})
afterEach(() => {
  scope?.stop()
  globalThis.$fetch = originalFetch
  vi.useRealTimers()
})
function setup() {
  scope = effectScope()
  return scope.run(() => useProductWriteRecovery(shallowRef(id)))!
}

describe('recuperación guiada de guardados de producto', () => {
  it('comprueba automáticamente tres veces y nunca vuelve a enviar una escritura', async () => {
    fetchMock.mockResolvedValue({ ...different, status: 'unavailable', canRetry: false, canDiscard: false })
    const recovery = setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(45_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(recovery.nextCheckAt.value).toBeNull()
    expect(fetchMock.mock.calls.every(([url]) => url === '/api/siigo/products/write-review')).toBe(true)
  })
  it('detiene las comprobaciones cuando el guardado ya está confirmado', async () => {
    fetchMock.mockResolvedValue({ ...different, status: 'synced', product })
    const recovery = setup()
    await vi.advanceTimersByTimeAsync(180_000)
    expect(recovery.review.value?.status).toBe('synced')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('un intento reciente no admite reenvío ni descarte desde el cliente', async () => {
    fetchMock.mockResolvedValue({ ...different, canRetry: false, canDiscard: false })
    const recovery = setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(await recovery.retry()).toBeNull()
    expect(await recovery.resolve(true)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('dos clics de reenvío disparan una sola acción explícita', async () => {
    fetchMock.mockImplementation(async url => url.endsWith('/retry-write') ? product : different)
    const recovery = setup()
    await vi.advanceTimersByTimeAsync(0)
    const results = await Promise.all([recovery.retry(), recovery.retry()])
    expect(results).toEqual([product, null])
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/retry-write'))).toHaveLength(1)
  })
  it('un nuevo fallo conserva su causa y sigue al intento nuevo sin reintentar otra escritura', async () => {
    fetchMock.mockResolvedValueOnce(different)
      .mockRejectedValueOnce({ data: { data: { operationId: nextId, cause: { message: 'Siigo no está disponible' } } } })
      .mockResolvedValueOnce({ ...different, status: 'unavailable', operationId: nextId, canRetry: false, canDiscard: false })
    const recovery = setup()
    await vi.advanceTimersByTimeAsync(0)
    await recovery.retry()
    await vi.advanceTimersByTimeAsync(0)
    expect(recovery.errorMessage.value).toBe('Siigo no está disponible')
    expect(fetchMock.mock.calls[2]).toEqual(['/api/siigo/products/write-review', { method: 'POST', body: { operationId: nextId }, retry: 0 }])
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/retry-write'))).toHaveLength(1)
  })
  it('carga el borrador correcto después de seguir una respuesta perdida y cierra el intento vigente', async () => {
    fetchMock.mockResolvedValueOnce({ ...different, operationId: nextId }).mockResolvedValueOnce({ productId: id })
    const recovery = setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(await recovery.resolve(true)).toEqual({ operationIds: [id, nextId], input })
    expect(fetchMock.mock.calls[1]).toEqual(['/api/siigo/products/discard-write', { method: 'POST', body: { productId: id, operationId: nextId }, retry: 0 }])
  })
  it('permite recuperar los cambios de un intento cerrado sin volver a descartarlo', async () => {
    fetchMock.mockResolvedValue({ ...different, status: 'closed', canRetry: false, canDiscard: false })
    const recovery = setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(await recovery.resolve(true)).toEqual({ operationIds: [id], input })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('comprueba al terminar la espera y detiene las consultas si Siigo conserva los valores anteriores', async () => {
    const availableAt = new Date(Date.now() + 300_000).toISOString()
    fetchMock.mockResolvedValueOnce({ ...different, availableAt, canRetry: false, canDiscard: false })
      .mockResolvedValueOnce({ ...different, status: 'reverted', product, canRetry: false, canDiscard: false })
    const recovery = setup()
    await vi.advanceTimersByTimeAsync(0)
    expect(recovery.nextCheckAt.value).toBe(Date.parse(availableAt))
    await vi.advanceTimersByTimeAsync(300_000)
    expect(recovery.review.value?.status).toBe('reverted')
    expect(recovery.nextCheckAt.value).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('restaura sin reconsultas si un reenvío explícito falla y Siigo conserva los valores anteriores', async () => {
    fetchMock.mockResolvedValueOnce(different).mockRejectedValueOnce({ data: { data: { restoredProduct: product } } })
    const recovery = setup()
    await vi.advanceTimersByTimeAsync(0)
    await recovery.retry()
    expect(recovery.review.value).toMatchObject({ status: 'reverted', product, canRetry: false, canDiscard: false })
    await vi.advanceTimersByTimeAsync(300_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('salir de la página cancela las comprobaciones pendientes', async () => {
    fetchMock.mockResolvedValue({ ...different, status: 'unavailable' })
    setup()
    await vi.advanceTimersByTimeAsync(0)
    scope!.stop()
    await vi.advanceTimersByTimeAsync(180_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
