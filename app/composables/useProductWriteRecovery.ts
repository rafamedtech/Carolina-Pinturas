import type { MaybeRefOrGetter } from 'vue'
import type { ProductWriteReview } from '~/types/siigo-products'
import type { SiigoProduct } from '~/types/siigo'

export function useProductWriteRecovery(operation: MaybeRefOrGetter<string>) {
  const activeId = shallowRef('')
  const review = shallowRef<ProductWriteReview | null>(null)
  const checking = shallowRef(false)
  const acting = shallowRef(false)
  const errorMessage = shallowRef('')
  const actionError = shallowRef('')
  const attempts = shallowRef(0)
  const nextCheckAt = shallowRef<number | null>(null)
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  function stopTimer() {
    clearTimeout(timer)
    nextCheckAt.value = null
  }
  function message(error: unknown) {
    const failure = error as { data?: { statusMessage?: string, data?: { cause?: { message?: string } } } }
    const text = failure.data?.data?.cause?.message || failure.data?.statusMessage || 'No se pudo completar la comprobación. Tus cambios pendientes siguen conservados.'
    return /products service.*unavailable/i.test(text) ? 'El servicio de productos de Siigo no está disponible. Intenta más tarde.' : text
  }
  async function refresh(automatic = false) {
    if (checking.value || acting.value || !activeId.value) return
    stopTimer()
    const current = generation
    checking.value = true
    attempts.value++
    try {
      const result = await $fetch<ProductWriteReview>('/api/siigo/products/write-review', { method: 'POST', body: { operationId: activeId.value }, retry: 0 })
      if (current !== generation) return
      activeId.value = result.operationId
      review.value = result
      errorMessage.value = actionError.value
    } catch (error: unknown) {
      if (current !== generation) return
      errorMessage.value = message(error)
    } finally {
      if (current === generation) {
        checking.value = false
        if (automatic && attempts.value < 3 && (!review.value || ['unavailable', 'different', 'local_error'].includes(review.value.status))) {
          const delay = attempts.value === 1 ? 15_000 : 45_000
          nextCheckAt.value = Date.now() + delay
          timer = setTimeout(() => void refresh(true), delay)
        }
      }
    }
  }
  async function retry(): Promise<SiigoProduct | null> {
    if (acting.value || checking.value || !review.value?.canRetry) return null
    stopTimer()
    acting.value = true
    errorMessage.value = ''
    actionError.value = ''
    let inspectAgain = false
    try {
      return await $fetch<SiigoProduct>('/api/siigo/products/retry-write', { method: 'POST', body: { operationId: activeId.value }, retry: 0 })
    } catch (error: unknown) {
      errorMessage.value = message(error)
      actionError.value = errorMessage.value
      const next = (error as { data?: { data?: { operationId?: string } } }).data?.data?.operationId
      if (next && next !== activeId.value) {
        generation++
        activeId.value = next
        attempts.value = 0
        review.value = null
      }
      inspectAgain = true
      return null
    } finally {
      acting.value = false
      if (inspectAgain) void refresh(true)
    }
  }
  async function resolve(loadChanges: boolean) {
    if (acting.value || checking.value || !review.value || (review.value.status !== 'closed' && !review.value.canDiscard)) return null
    stopTimer()
    acting.value = true
    errorMessage.value = ''
    try {
      if (review.value.status !== 'closed') {
        await $fetch('/api/siigo/products/discard-write', { method: 'POST', body: { productId: review.value.productId, operationId: activeId.value }, retry: 0 })
      }
      const input = loadChanges ? { ...review.value.input, composition: { ...review.value.input.composition, version: review.value.currentCompositionVersion ?? review.value.input.composition.version } } : undefined
      return { operationIds: [...new Set([toValue(operation), activeId.value])], input }
    } catch (error: unknown) {
      errorMessage.value = message(error)
      return null
    } finally {
      acting.value = false
    }
  }
  watch(() => toValue(operation), (id) => {
    stopTimer()
    generation++
    activeId.value = id
    review.value = null
    checking.value = false
    attempts.value = 0
    actionError.value = ''
    errorMessage.value = ''
    if (id) void refresh(true)
  }, { immediate: true })
  onScopeDispose(() => {
    generation++
    stopTimer()
  })
  return { review, checking, acting, errorMessage, attempts, nextCheckAt, refresh, retry, resolve }
}
