import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import {
  fetchSiigoCustomerPage,
  getAllSiigoCustomers
} from '../../utils/siigo-customer-catalog'
import { withLocalCustomerInternals } from '../../utils/siigo-customer-repository'
import { listQuery } from '../../utils/siigo'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const query = getQuery(event)
  const catalog = query.all === 'true'
    ? await getAllSiigoCustomers()
    : await fetchSiigoCustomerPage(listQuery(event))

  return {
    ...catalog,
    results: await withLocalCustomerInternals(catalog.results)
  }
})
