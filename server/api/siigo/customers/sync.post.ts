import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import {
  getCompleteSiigoCustomerCatalog,
  siigoCustomerCatalogType
} from '../../../utils/siigo-customer-catalog-view'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const query = getQuery(event)
  const customerType = siigoCustomerCatalogType(query.customer_type)

  return getCompleteSiigoCustomerCatalog({ customerType, fresh: true })
})
