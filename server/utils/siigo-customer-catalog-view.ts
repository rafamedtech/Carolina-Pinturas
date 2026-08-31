import type { SiigoCustomerCatalogType } from '~/utils/siigoCustomer'
import { invalidateSiigoCatalog } from './siigo-catalog'
import { getAllSiigoCustomers } from './siigo-customer-catalog'
import { synchronizeSiigoCustomerSubset } from './siigo-customer-import'
import { withLocalCustomerInternals } from './siigo-customer-repository'

export function siigoCustomerCatalogType(value: unknown): SiigoCustomerCatalogType | undefined {
  if (value === undefined) return undefined
  if (value === 'Customer' || value === 'Supplier') return value

  throw createError({
    statusCode: 400,
    statusMessage: 'El tipo de cliente solicitado no es válido.'
  })
}

export async function getCompleteSiigoCustomerCatalog(options: {
  customerType?: SiigoCustomerCatalogType
  fresh?: boolean
} = {}) {
  if (options.fresh) invalidateSiigoCatalog('customers')

  const catalog = await getAllSiigoCustomers()
  const customerType = options.customerType

  if (customerType) await synchronizeSiigoCustomerSubset(catalog.results)
  const results = await withLocalCustomerInternals(
    catalog.results,
    customerType ? { role: customerType } : undefined
  )

  return {
    ...catalog,
    results,
    ...(customerType && catalog.pagination
      ? {
          pagination: {
            ...catalog.pagination,
            page: 1,
            page_size: results.length,
            total_results: results.length
          }
        }
      : {})
  }
}
