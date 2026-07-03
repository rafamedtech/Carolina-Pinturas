import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'

export function useCustomersCatalog() {
  const catalog = useState<SiigoListResponse<SiigoCustomer> | null>('customers-catalog-data', () => null)
  const { data, status, error, refresh } = useFetch<SiigoListResponse<SiigoCustomer>>('/api/siigo/customers', {
    key: 'customers-catalog-request',
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
