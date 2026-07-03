import type { SiigoListResponse, SiigoProduct } from '~/types/siigo'

export function useProductsCatalog() {
  const catalog = useState<SiigoListResponse<SiigoProduct> | null>('products-catalog-data', () => null)
  const { data, status, error, refresh } = useFetch<SiigoListResponse<SiigoProduct>>('/api/siigo/products', {
    key: 'products-catalog-request',
    query: { all: 'true' },
    lazy: true
  })

  watch(data, (value) => {
    if (value) catalog.value = value
  }, { immediate: true })

  async function refreshCatalog() {
    await refresh()

    if (data.value) {
      catalog.value = data.value
    }
  }

  return {
    data: catalog,
    status,
    error,
    refresh: refreshCatalog
  }
}
