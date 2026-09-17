import * as z from 'zod'
import { purchaseDate } from '#shared/schemas/purchase'
import { requireRole } from '../../utils/auth'
import { usePrisma } from '../../utils/prisma'
import { purchaseInclude, purchaseView } from '../../utils/purchases'

const filters = z.object({ search: z.string().max(200).optional(), dateFrom: purchaseDate.optional(), dateTo: purchaseDate.optional(), status: z.enum(['borrador', 'confirmada', 'cancelada']).optional() })
export default eventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const parsed = filters.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Filtros inválidos.' })
  const q = parsed.data
  const rows = await usePrisma().purchaseOrder.findMany({ where: {
    ...(q.search ? { providerName: { contains: q.search, mode: 'insensitive' } } : {}),
    ...(q.status ? { status: q.status } : {}),
    date: { ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}), ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}) }
  }, include: purchaseInclude, orderBy: { folio: 'desc' } })
  return { results: rows.map(purchaseView) }
})
