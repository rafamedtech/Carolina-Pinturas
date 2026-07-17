import { requireUser } from '../../utils/auth'
import { listOrders } from '../../utils/orders'

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, maximum)
}

function dateOnly(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : value
}

export default eventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)

  return listOrders({
    page: positiveInteger(query.page, 1, 100_000),
    pageSize: positiveInteger(query.page_size, 25, 100),
    search: typeof query.search === 'string' ? query.search.trim().slice(0, 200) : undefined,
    statusKey: typeof query.status === 'string' ? query.status.trim().slice(0, 32) : undefined,
    paymentStatus: typeof query.payment_status === 'string' ? query.payment_status.trim().slice(0, 32) : undefined,
    paymentMethod: typeof query.payment_method === 'string' ? query.payment_method.trim().slice(0, 32) : undefined,
    dateFrom: dateOnly(query.date_from),
    dateTo: dateOnly(query.date_to),
    igualacion: query.igualacion === 'true' || query.igualacion === '1'
  }, user)
})
