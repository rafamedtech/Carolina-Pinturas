import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { productQuerySchema } from '#shared/schemas/product'
import { requireRole } from '../../utils/auth'
import { listProducts } from '../../utils/siigo-products'
import { persistProductCatalog } from '../../utils/product-catalog-persistence'
import { listStoredProducts } from '../../utils/stored-products'
import { usePrisma } from '../../utils/prisma'
import { attachProductCompositions } from '../../utils/product-compositions'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const parsed = productQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los filtros de productos.', data: parsed.error.flatten() })
  const db = usePrisma()
  // Only an explicit refresh reads Siigo. Navigation and filters read PostgreSQL.
  if (parsed.data.refresh === 'true') {
    const startedAt = new Date()
    const catalog = await listProducts({ all: 'true', refresh: 'true', active: 'all', page: 1, page_size: 100 })
    await persistProductCatalog(db, catalog.results)
    // Preserve historical references, but stop offering products removed from Siigo.
    await db.siigoProduct.updateMany({
      where: { id: { notIn: catalog.results.map(product => product.id) }, syncedAt: { lt: startedAt } },
      data: { active: false }
    })
  }
  let results = await attachProductCompositions(db, await listStoredProducts(db, parsed.data))
  if (parsed.data.products_only === 'true' || parsed.data.simple_only === 'true' || parsed.data.usage) {
    results = results.filter(p => (!p.type || p.type === 'Product') && !p.internal?.syncPending && ((parsed.data.simple_only !== 'true' && parsed.data.usage !== 'purchase') || p.internal?.composition?.kind !== 'composite'))
    if (parsed.data.usage) results = results.filter(p => p.internal?.availability?.[parsed.data.usage!] !== false)
  }
  const total = results.length
  if (parsed.data.all !== 'true') results = results.slice((parsed.data.page - 1) * parsed.data.page_size, parsed.data.page * parsed.data.page_size)
  return { results, pagination: { page: parsed.data.all === 'true' ? 1 : parsed.data.page, page_size: parsed.data.all === 'true' ? total : parsed.data.page_size, total_results: total } }
})
