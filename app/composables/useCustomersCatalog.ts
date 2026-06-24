import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'

export function useCustomersCatalog() {
  const catalog = useState<SiigoListResponse<SiigoCustomer> | null>('customers-catalog-data', () => null)
  const { data, status, error, refresh } = useFetch<SiigoListResponse<SiigoCustomer>>('/api/siigo/customers', {
    key: 'customers-catalog-request',
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
