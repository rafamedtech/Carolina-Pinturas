import * as z from 'zod'
import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { getProductSatCatalog, searchProductSat } from '../../../../utils/siigo-product-sat'

const querySchema = z.object({ kind: z.enum(['unit', 'key']), q: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).max(10000).default(1) })
export default eventHandler(async (event) => {
  await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  const query = querySchema.safeParse(getQuery(event))
  if (!query.success) throw createError({ statusCode: 400, statusMessage: 'Consulta SAT inválida.' })
  return searchProductSat(await getProductSatCatalog(), query.data.kind, query.data.q, query.data.page)
})
