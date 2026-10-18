import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { productQuerySchema } from '#shared/schemas/product'
import { requireRole } from '../../utils/auth'
import { listProducts } from '../../utils/siigo-products'
import { persistProductCatalog } from '../../utils/product-catalog-persistence'
import { usePrisma } from '../../utils/prisma'
import { attachProductCompositions } from '../../utils/product-compositions'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const parsed = productQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los filtros de productos.', data: parsed.error.flatten() })
  const catalog = await listProducts(parsed.data)
  await persistProductCatalog(usePrisma(), catalog.results)
  let results = await attachProductCompositions(usePrisma(), catalog.results)
  if (parsed.data.products_only === 'true' || parsed.data.simple_only === 'true') {
    results = results.filter(p => (!p.type || p.type === 'Product') && !p.internal?.syncPending && (parsed.data.simple_only !== 'true' || p.internal?.composition?.kind !== 'composite'))
    const total = results.length
    if (parsed.data.all !== 'true') results = results.slice((parsed.data.page - 1) * parsed.data.page_size, parsed.data.page * parsed.data.page_size)
    return { results, pagination: { page: parsed.data.all === 'true' ? 1 : parsed.data.page, page_size: parsed.data.all === 'true' ? total : parsed.data.page_size, total_results: total } }
  }
  return { ...catalog, results }
})
