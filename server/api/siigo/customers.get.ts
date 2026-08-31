import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import {
  fetchSiigoCustomerPage,
  getAllSiigoCustomers
} from '../../utils/siigo-customer-catalog'
import { withLocalCustomerInternals } from '../../utils/siigo-customer-repository'
import { synchronizeSiigoCustomerSubset } from '../../utils/siigo-customer-import'
import { listQuery } from '../../utils/siigo'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const query = getQuery(event)
  const customerType = query.customer_type === undefined
    ? undefined
    : query.customer_type === 'Supplier'
      ? 'Supplier' as const
      : throwUnsupportedCustomerType()
  const catalog = query.all === 'true' || customerType
    ? await getAllSiigoCustomers()
    : await fetchSiigoCustomerPage(listQuery(event))
  const externalCustomers = customerType
    ? catalog.results.filter(customer => customer.type?.trim().toLowerCase() === customerType.toLowerCase())
    : catalog.results
  if (customerType) await synchronizeSiigoCustomerSubset(externalCustomers)
  const results = await withLocalCustomerInternals(externalCustomers, { type: customerType })

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
})

function throwUnsupportedCustomerType(): never {
  throw createError({
    statusCode: 400,
    statusMessage: 'El tipo de cliente solicitado no es válido.'
  })
}
