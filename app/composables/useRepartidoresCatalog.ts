import type { Repartidor } from '~/types/orders'

export function useRepartidoresCatalog(options: { all?: boolean } = {}) {
  const catalog = useState<Repartidor[]>(
    options.all ? 'repartidores-catalog-all-data' : 'repartidores-catalog-data',
    () => []
  )
  // `lazy` no bloquea el SSR: el HTML puede salir antes de que el fetch
  // resuelva y el cliente hidrata con datos que el server no alcanzó a
  // renderizar (hydration mismatch en la tabla). `server: false` lo evita
  // dejando el fetch fuera del SSR por completo.
  const { data, status, error, refresh } = useFetch<Repartidor[]>('/api/repartidores', {
    key: options.all ? 'repartidores-catalog-all-request' : 'repartidores-catalog-request',
    query: options.all ? { all: 'true' } : undefined,
    lazy: true,
    server: false,
    default: () => []
  })

  watch(data, (value) => {
    catalog.value = value || []
  }, { immediate: true })

  async function refreshCatalog() {
    await refresh()
    catalog.value = data.value || []
  }

  function addToCatalog(repartidor: Repartidor) {
    catalog.value = [...catalog.value, repartidor].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }

  return {
    data: catalog,
    status,
    error,
    refresh: refreshCatalog,
    addToCatalog
  }
}
