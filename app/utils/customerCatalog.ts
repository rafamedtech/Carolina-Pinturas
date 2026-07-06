import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'

// Suma un cliente recién creado al catálogo en memoria (al inicio, para que
// sea visible de inmediato) sin esperar una recarga completa desde Siigo.
export function addCustomerToCatalog(
  catalog: SiigoListResponse<SiigoCustomer> | null,
  customer: SiigoCustomer
): SiigoListResponse<SiigoCustomer> {
  if (!catalog) {
    return {
      results: [customer],
      pagination: { total_results: 1, page: 1, page_size: 1 }
    }
  }

  catalog.results.unshift(customer)

  if (catalog.pagination?.total_results != null) {
    catalog.pagination.total_results += 1
  }

  return catalog
}
