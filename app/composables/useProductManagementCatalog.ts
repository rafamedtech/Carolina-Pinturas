import type { SiigoListResponse, SiigoProduct } from '~/types/siigo'

export function useProductManagementCatalog(filters: Ref<Record<string, string>>) {
  const query = computed(() => ({ ...filters.value, all: 'true' }))
  const request = useFetch<SiigoListResponse<SiigoProduct>>('/api/siigo/products', {
    key: 'product-management-catalog', query, server: false, lazy: true
  })
  const refreshing = shallowRef(false)
  const refreshError = shallowRef<{ data: { statusMessage: string } }>()
  watch(filters, () => {
    refreshError.value = undefined
  })
  async function refresh() {
    if (refreshing.value) return
    refreshing.value = true
    refreshError.value = undefined
    try {
      request.data.value = await $fetch<SiigoListResponse<SiigoProduct>>('/api/siigo/products', { query: { ...query.value, refresh: 'true' } })
      request.error.value = undefined
      await refreshNuxtData('products-catalog-request')
    } catch (error: unknown) {
      refreshError.value = { data: { statusMessage: (error as { data?: { statusMessage?: string } }).data?.statusMessage || 'No se pudo actualizar el catálogo.' } }
    } finally {
      refreshing.value = false
    }
  }
  return { data: request.data, status: computed(() => refreshing.value ? 'pending' : request.status.value), error: computed(() => refreshError.value ?? request.error.value), refresh }
}
