import { requireUser } from '../../utils/auth'
import { listOrders } from '../../utils/orders'

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, maximum)
}

export default eventHandler(async (event) => {
  requireUser(event)
  const query = getQuery(event)

  return listOrders({
    page: positiveInteger(query.page, 1, 100_000),
    pageSize: positiveInteger(query.page_size, 25, 100),
    search: typeof query.search === 'string' ? query.search.trim().slice(0, 200) : undefined,
    statusKey: typeof query.status === 'string' ? query.status.trim().slice(0, 32) : undefined
  })
})
