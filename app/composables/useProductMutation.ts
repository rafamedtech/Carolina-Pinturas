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

  async function save(input: ProductInput | { active: boolean }, id?: string) {
    if (saving.value || ambiguous.value) return null
    saving.value = true
    errorMessage.value = ''
    lookupCode.value = 'code' in input ? input.code : ''
    try {
      const product = await $fetch<SiigoProduct>(id ? `/api/siigo/products/${encodeURIComponent(id)}${'code' in input ? '' : '/active'}` : '/api/siigo/products', {
        method: id ? ('code' in input ? 'PUT' : 'PATCH') : 'POST', body: input, retry: 0
      })
      // The mutation is already confirmed. A failed refresh must not invite a second write.
      await refreshNuxtData().catch(() => undefined)
      return product
    } catch (error: unknown) {
      const failure = error as { statusCode?: number, data?: { statusMessage?: string, data?: { ambiguous?: boolean, operationId?: string } } }
      operationId.value = failure.data?.data?.operationId ?? ''
      ambiguous.value = failure.data?.data?.ambiguous ?? (!failure.statusCode || failure.statusCode >= 500)
      errorMessage.value = ambiguous.value
        ? 'No se pudo confirmar el guardado. Consulta el producto antes de volver a intentar.'
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
        await refreshNuxtData().catch(() => undefined)
        return product
      }
      lookupResults.value = id
        ? [await $fetch<SiigoProduct>(`/api/siigo/products/${encodeURIComponent(id)}`, { query: { refresh: 'true' } })]
        : (await $fetch<{ results: SiigoProduct[] }>('/api/siigo/products', { query: { code: lookupCode.value, active: 'all', refresh: 'true' } })).results
    } catch (error: unknown) {
      errorMessage.value = (error as { data?: { statusMessage?: string } }).data?.statusMessage || 'No se pudo consultar el resultado. Vuelve a consultar antes de guardar.'
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
      // Do not refresh the form: the administrator may have unsaved corrections.
      return true
    } catch (error: unknown) {
      errorMessage.value = (error as { data?: { statusMessage?: string } }).data?.statusMessage || 'No se pudo desbloquear el producto. Consulta el guardado antes de reintentar.'
      return false
    } finally {
      checking.value = false
    }
  }
  return { saving, errorMessage, ambiguous, checking, lookupResults, save, check, discard }
}
