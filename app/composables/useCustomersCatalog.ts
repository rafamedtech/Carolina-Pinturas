import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'

export function useCustomersCatalog() {
  const catalog = useState<SiigoListResponse<SiigoCustomer> | null>('customers-catalog-data', () => null)
  // El endpoint pagina TODO el catálogo de Siigo en el servidor (docenas de
  // llamadas secuenciales): con `lazy` puede no terminar antes de que el SSR
  // envíe el HTML, y el cliente hidrata con más filas que las que el server
  // alcanzó a renderizar (hydration mismatch). `server: false` evita SSR-ear
  // este fetch y lo deja consistente en ambos lados desde el arranque.
  const { data, status, error, refresh } = useFetch<SiigoListResponse<SiigoCustomer>>('/api/siigo/customers', {
    key: 'customers-catalog-request',
    query: { all: 'true' },
    lazy: true,
    server: false
  })

  watch(data, (value) => {
    if (value) catalog.value = value
  }, { immediate: true })

  useTrackSiigoLoading(status)

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
