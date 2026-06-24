import type { PriceCatalogResponse } from '~/types/catalog'

export function usePriceCatalog() {
  const query = shallowRef('')
  const { data, error, status } = useFetch<PriceCatalogResponse>('/api/catalog/prices')

  const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase('es-MX'))
  const products = computed(() => data.value?.products || [])
  const filteredProducts = computed(() => {
    if (!normalizedQuery.value) return products.value

    return products.value.filter(product =>
      `${product.code} ${product.name}`.toLocaleLowerCase('es-MX').includes(normalizedQuery.value)
    )
  })

  return {
    query,
    products: filteredProducts,
    totalProducts: computed(() => products.value.length),
    updatedAt: computed(() => data.value?.updatedAt),
    error,
    status
  }
}
