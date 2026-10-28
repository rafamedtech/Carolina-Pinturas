import type { SiigoProduct } from '~/types/siigo'
import type { ProductInput } from '~/types/siigo-products'

export function useProductMutation() {
  const saving = shallowRef(false)
  const errorMessage = shallowRef('')
  const ambiguous = shallowRef(false)
  const lookupCode = shallowRef('')
  const checking = shallowRef(false)
  const lookupResults = ref<SiigoProduct[]>([])
  const operationId = shallowRef('')
  const saveFailureMessage = shallowRef('')
  const restoredProduct = shallowRef<SiigoProduct | null>(null)

  async function save(input: ProductInput | { active: boolean }, id?: string) {
    if (saving.value || ambiguous.value) return null
    saving.value = true
    errorMessage.value = ''
    saveFailureMessage.value = ''
    restoredProduct.value = null
    lookupCode.value = 'code' in input ? input.code : ''
    try {
      const product = await $fetch<SiigoProduct>(id ? `/api/siigo/products/${encodeURIComponent(id)}${'code' in input ? '' : '/active'}` : '/api/siigo/products', {
        method: id ? ('code' in input ? 'PUT' : 'PATCH') : 'POST', body: input, retry: 0
      })
      // The mutation is already confirmed. A failed refresh must not invite a second write.
      await refreshNuxtData().catch(() => undefined)
      return product
    } catch (error: unknown) {
      const failure = error as { statusCode?: number, data?: { statusMessage?: string, data?: { ambiguous?: boolean, operationId?: string, restoredProduct?: SiigoProduct, cause?: { message?: string } } } }
      operationId.value = failure.data?.data?.operationId ?? ''
      ambiguous.value = failure.data?.data?.ambiguous ?? (!failure.statusCode || failure.statusCode >= 500)
      restoredProduct.value = failure.data?.data?.restoredProduct ?? null
      if (restoredProduct.value) {
        operationId.value = ''
        await refreshNuxtData(['products-catalog-request', 'product-management-catalog', 'product-brand-options']).catch(() => undefined)
      }
      const cause = failure.data?.data?.cause?.message ?? ''
      saveFailureMessage.value = /products service.*unavailable/i.test(cause)
        ? 'El servicio de productos de Siigo no está disponible. Intenta más tarde.'
        : cause
      errorMessage.value = ambiguous.value
        ? [saveFailureMessage.value || 'No se pudo confirmar el guardado.', 'Consulta el resultado antes de volver a guardar.'].join(' ')
        : failure.data?.statusMessage || 'No se pudo guardar el producto.'
      return null
    } finally {
      saving.value = false
    }
  }
  async function check(id?: string, pendingWriteId?: string) {
    checking.value = true
    try {
      if (operationId.value || pendingWriteId) {
        const product = await $fetch<SiigoProduct>('/api/siigo/products/recover', { method: 'POST', body: { operationId: operationId.value || pendingWriteId }, retry: 0 })
        lookupResults.value = [product]
        ambiguous.value = false
        operationId.value = ''
        errorMessage.value = ''
        saveFailureMessage.value = ''
        await refreshNuxtData().catch(() => undefined)
        return product
      }
      lookupResults.value = id
        ? [await $fetch<SiigoProduct>(`/api/siigo/products/${encodeURIComponent(id)}`, { query: { refresh: 'true' } })]
        : (await $fetch<{ results: SiigoProduct[] }>('/api/siigo/products', { query: { code: lookupCode.value, active: 'all', refresh: 'true' } })).results
    } catch (error: unknown) {
      const message = (error as { data?: { statusMessage?: string } }).data?.statusMessage || 'No se pudo consultar el resultado. Vuelve a consultar antes de guardar.'
      errorMessage.value = [saveFailureMessage.value, message].filter(Boolean).join(' ')
    } finally {
      checking.value = false
    }
  }
  async function discard(productId: string, pendingWriteId: string) {
    if (checking.value || saving.value) return false
    checking.value = true
    try {
      await $fetch('/api/siigo/products/discard-write', { method: 'POST', body: { productId, operationId: pendingWriteId }, retry: 0 })
      ambiguous.value = false
      operationId.value = ''
      errorMessage.value = ''
      saveFailureMessage.value = ''
      // Do not refresh the form: the administrator may have unsaved corrections.
      return true
    } catch (error: unknown) {
      errorMessage.value = (error as { data?: { statusMessage?: string } }).data?.statusMessage || 'No se pudo desbloquear el producto. Consulta el guardado antes de reintentar.'
      return false
    } finally {
      checking.value = false
    }
  }
  function clearPending() {
    ambiguous.value = false
    operationId.value = ''
    errorMessage.value = ''
    saveFailureMessage.value = ''
  }
  return { saving, errorMessage, ambiguous, checking, lookupResults, restoredProduct, operationId: readonly(operationId), save, check, discard, clearPending }
}
