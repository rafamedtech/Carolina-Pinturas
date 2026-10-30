import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'

export const customerCatalogTabs = [
  { label: 'Todos', value: 'all' },
  { label: 'Clientes', value: 'clientes' },
  { label: 'Proveedores', value: 'proveedores' },
  { label: 'Requieren factura', value: 'requieren_factura' }
]

export function customerCatalogRoles(customer: SiigoCustomer) {
  return customer.internal?.roles ?? {
    customer: customer.type === 'Customer',
    supplier: customer.type === 'Supplier'
  }
}

export function filterCustomerCatalog(customers: SiigoCustomer[], view: string, search = '') {
  const value = search.trim().toLowerCase()
  return customers.filter((customer) => {
    const roles = customerCatalogRoles(customer)
    if (view === 'clientes' && !roles.customer) return false
    if (view === 'proveedores' && !roles.supplier) return false
    if (view === 'requieren_factura' && customer.internal?.requires_invoice !== true) return false
    if (!value) return true

    const name = customer.name?.filter(Boolean).join(' ') || ''
    const email = customer.contacts?.[0]?.email || ''
    return `${customer.rfc_id || ''} ${name} ${email}`.toLowerCase().includes(value)
  })
}

export function customerCatalogRoleLabel(customer: SiigoCustomer) {
  const roles = customerCatalogRoles(customer)
  return [roles.customer && 'Cliente', roles.supplier && 'Proveedor'].filter(Boolean).join(' y ') || 'Sin clasificar'
}

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
