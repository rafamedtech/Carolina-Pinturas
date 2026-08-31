import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'

export function useCustomersCatalog(options: {
  immediate?: boolean
  customerType?: 'Customer' | 'Supplier'
} = {}) {
  const refreshing = shallowRef(false)
  // Siigo es la fuente de verdad. El servidor agrega únicamente las preferencias
  // internas del cliente que pertenecen a la aplicación.
  const { data, status, error } = useFetch<SiigoListResponse<SiigoCustomer>>('/api/siigo/customers', {
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
      data.value = await $fetch('/api/siigo/customers/sync', {
        method: 'POST',
        query: { customer_type: options.customerType }
      })
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
