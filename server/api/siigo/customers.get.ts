import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { listLocalCustomers } from '../../utils/siigo-customer-repository'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)

  const query = getQuery(event)
  const page = typeof query.page === 'string' ? Number(query.page) : 1
  const pageSize = typeof query.page_size === 'string' ? Number(query.page_size) : 25

  return listLocalCustomers({
    all: query.all === 'true',
    page: Number.isInteger(page) ? page : 1,
    pageSize: Number.isInteger(pageSize) ? pageSize : 25
  })
})
