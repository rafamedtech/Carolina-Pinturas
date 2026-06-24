import type { SiigoListResponse, SiigoProduct } from '~/types/siigo'

export function useProductsCatalog() {
  const catalog = useState<SiigoListResponse<SiigoProduct> | null>('products-catalog-data', () => null)
  const { data, status, error, refresh } = useFetch<SiigoListResponse<SiigoProduct>>('/api/siigo/products', {
    key: 'products-catalog-request',
    query: { all: 'true' },
    immediate: false
  })

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
