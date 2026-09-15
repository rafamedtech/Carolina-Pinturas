import * as z from 'zod'
import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { productInputSchema } from '#shared/schemas/product'
import { requireRole } from '../../../utils/auth'
import { mutateProduct } from '../../../utils/siigo-products'

export default eventHandler(async (event) => {
  await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const parsed = productInputSchema.safeParse(await readBody(event))
  if (!id.success) throw createError({ statusCode: 400, statusMessage: 'Identificador de producto inválido.' })
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los datos del producto.', data: parsed.error.flatten() })
  return mutateProduct(parsed.data, id.data)
})
