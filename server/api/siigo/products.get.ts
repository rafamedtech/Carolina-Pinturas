import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { productQuerySchema } from '#shared/schemas/product'
import { requireRole } from '../../utils/auth'
import { listProducts } from '../../utils/siigo-products'
import { persistProductCatalog } from '../../utils/product-catalog-persistence'
import { usePrisma } from '../../utils/prisma'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const parsed = productQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los filtros de productos.', data: parsed.error.flatten() })
  const catalog = await listProducts(parsed.data)
  await persistProductCatalog(usePrisma(), catalog.results)
  return catalog
})
