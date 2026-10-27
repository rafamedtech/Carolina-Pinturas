import type { SiigoListResponse, SiigoProduct } from '~/types/siigo'

export function useProductsCatalog() {
  const catalog = useState<SiigoListResponse<SiigoProduct> | null>('products-catalog-data', () => null)
  // Initial reads use PostgreSQL. Only refreshCatalog requests a Siigo sync.
  const { data, status, error, refresh } = useFetch<SiigoListResponse<SiigoProduct>>('/api/siigo/products', {
    key: 'products-catalog-request',
    query: { all: 'true', products_only: 'true', usage: 'sale' },
    lazy: true,
    server: false
  })

  watch(data, (value) => {
    if (value) catalog.value = value
  }, { immediate: true })

  useTrackSiigoLoading(status)

  async function refreshCatalog() {
    await $fetch('/api/siigo/products', { query: { all: 'true', products_only: 'true', usage: 'sale', refresh: 'true' } })
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
