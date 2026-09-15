import * as z from 'zod'
import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { getProductImage } from '../../../utils/product-images'
import { getProductDetail } from '../../../utils/siigo-products'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, statusMessage: 'Identificador de producto inválido.' })
  const [product, image] = await Promise.all([
    getProductDetail(id.data, getQuery(event).refresh === 'true'),
    getProductImage(id.data, event)
  ])
  return { ...product, internal: { image } }
})
