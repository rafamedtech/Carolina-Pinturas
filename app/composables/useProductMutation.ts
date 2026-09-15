import type { SiigoProduct } from '~/types/siigo'
import type { ProductInput } from '~/types/siigo-products'

export function useProductMutation() {
  const saving = shallowRef(false)
  const errorMessage = shallowRef('')
  const ambiguous = shallowRef(false)
  const lookupCode = shallowRef('')
  const checking = shallowRef(false)
  const lookupResults = ref<SiigoProduct[]>([])

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
      const failure = error as { statusCode?: number, data?: { statusMessage?: string, data?: { ambiguous?: boolean } } }
      ambiguous.value = failure.data?.data?.ambiguous === true || !failure.statusCode || failure.statusCode >= 500
      errorMessage.value = ambiguous.value
        ? 'No se pudo confirmar el guardado. Consulta el producto antes de volver a intentar.'
        : failure.data?.statusMessage || 'No se pudo guardar el producto.'
      return null
    } finally {
      saving.value = false
    }
  }
  async function check(id?: string) {
    checking.value = true
    try {
      lookupResults.value = id
        ? [await $fetch<SiigoProduct>(`/api/siigo/products/${encodeURIComponent(id)}`, { query: { refresh: 'true' } })]
        : (await $fetch<{ results: SiigoProduct[] }>('/api/siigo/products', { query: { code: lookupCode.value, active: 'all', refresh: 'true' } })).results
    } catch {
      errorMessage.value = 'No se pudo consultar el resultado. Vuelve a consultar antes de guardar.'
    } finally {
      checking.value = false
    }
  }
  return { saving, errorMessage, ambiguous, checking, lookupResults, save, check }
}
