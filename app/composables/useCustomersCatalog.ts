import type { SiigoCustomer, SiigoCustomerSyncResult, SiigoListResponse } from '~/types/siigo'

export function useCustomersCatalog(options: { immediate?: boolean } = {}) {
  const catalog = useState<SiigoListResponse<SiigoCustomer> | null>('customers-catalog-data', () => null)
  const syncing = shallowRef(false)
  // La lectura inicial proviene únicamente de PostgreSQL, por lo que es rápida
  // y segura para SSR. Siigo solo se consulta mediante la acción explícita de
  // sincronización y nunca durante la navegación ordinaria.
  const { data, status, error, refresh } = useFetch<SiigoListResponse<SiigoCustomer>>('/api/siigo/customers', {
    key: 'customers-catalog-request',
    query: { all: 'true' },
    immediate: options.immediate ?? true
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

  async function synchronizeWithSiigo() {
    syncing.value = true
    try {
      const result = await $fetch<SiigoCustomerSyncResult>('/api/siigo/customers/sync', {
        method: 'POST'
      })
      await refreshCatalog()
      return result
    } finally {
      syncing.value = false
    }
  }

  return {
    data: catalog,
    status,
    error,
    syncing: readonly(syncing),
    refresh: refreshCatalog,
    synchronizeWithSiigo
  }
}
