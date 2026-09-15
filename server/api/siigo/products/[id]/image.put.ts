import * as z from 'zod'
import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { saveProductImage } from '../../../../utils/product-images'

export default eventHandler(async (event) => {
  const user = await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, statusMessage: 'Identificador de producto inválido.' })
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'image' && part.filename)
  return saveProductImage(event, id.data, file?.data, user)
})
