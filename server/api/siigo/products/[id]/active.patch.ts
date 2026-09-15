import * as z from 'zod'
import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../../utils/auth'
import { mutateProduct } from '../../../../utils/siigo-products'

export default eventHandler(async (event) => {
  await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const parsed = z.object({ active: z.boolean() }).strict().safeParse(await readBody(event))
  if (!id.success || !parsed.success) throw createError({ statusCode: 400, statusMessage: 'Identificador o estado inválido.' })
  return mutateProduct(parsed.data, id.data)
})
