import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'

export function useCustomersCatalog(options: {
  immediate?: boolean
  customerType?: 'Supplier'
} = {}) {
  const refreshing = shallowRef(false)
  // Siigo es la fuente de verdad. El servidor agrega únicamente las preferencias
  // internas del cliente que pertenecen a la aplicación.
  const { data, status, error, refresh } = useFetch<SiigoListResponse<SiigoCustomer>>('/api/siigo/customers', {
    key: options.customerType
      ? `customers-catalog-request-${options.customerType.toLowerCase()}`
      : 'customers-catalog-request',
    query: {
      all: 'true',
      customer_type: options.customerType
    },
    immediate: options.immediate ?? true
  })
  const catalog = computed({
    get: () => data.value ?? null,
    set: (value) => { data.value = value ?? undefined }
  })

  async function refreshCatalog() {
    refreshing.value = true
    try {
      await $fetch('/api/siigo/customers/sync', {
        method: 'POST'
      })

      await refresh()
    } finally {
      refreshing.value = false
    }
  }

  return {
    data: catalog,
    status,
    error,
    refreshing: readonly(refreshing),
    refresh: refreshCatalog
  }
}
