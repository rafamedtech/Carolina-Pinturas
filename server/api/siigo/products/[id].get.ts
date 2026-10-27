import * as z from 'zod'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { getProductImage } from '../../../utils/product-images'
import { getProductDetail } from '../../../utils/siigo-products'
import { attachProductCompositions } from '../../../utils/product-compositions'
import { getStoredProduct } from '../../../utils/stored-products'
import { upsertSiigoProduct } from '../../../utils/siigo-persistence'
import { usePrisma } from '../../../utils/prisma'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, statusMessage: 'Identificador de producto inválido.' })
  const db = usePrisma()
  if (getQuery(event).refresh === 'true') {
    await upsertSiigoProduct(db, await getProductDetail(id.data, true))
  }
  const [product, image] = await Promise.all([
    getStoredProduct(db, id.data),
    getProductImage(id.data, event)
  ])
  const enriched = (await attachProductCompositions(db, [product]))[0]!
  return { ...enriched, internal: { ...enriched.internal, image } }
})
