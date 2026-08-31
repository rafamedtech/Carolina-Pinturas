import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import {
  fetchSiigoCustomerPage
} from '../../utils/siigo-customer-catalog'
import { withLocalCustomerInternals } from '../../utils/siigo-customer-repository'
import {
  getCompleteSiigoCustomerCatalog,
  siigoCustomerCatalogType
} from '../../utils/siigo-customer-catalog-view'
import { listQuery } from '../../utils/siigo'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const query = getQuery(event)
  const customerType = siigoCustomerCatalogType(query.customer_type)

  if (query.all === 'true' || customerType) {
    return getCompleteSiigoCustomerCatalog({ customerType })
  }

  const catalog = await fetchSiigoCustomerPage(listQuery(event))
  return { ...catalog, results: await withLocalCustomerInternals(catalog.results) }
})
