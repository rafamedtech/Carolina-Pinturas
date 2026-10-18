import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { productInputSchema } from '#shared/schemas/product'
import { requireRole } from '../../../utils/auth'
import { saveManagedProduct } from '../../../utils/managed-products'

export default eventHandler(async (event) => {
  await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  const parsed = productInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los datos del producto.', data: parsed.error.flatten() })
  const product = await saveManagedProduct(parsed.data)
  setResponseStatus(event, 201)
  return product
})
