import * as z from 'zod'
import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { deleteProductImage } from '../../../../utils/product-images'

export default eventHandler(async (event) => {
  await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, statusMessage: 'Identificador de producto inválido.' })
  await deleteProductImage(event, id.data)
  setResponseStatus(event, 204)
  return null
})
