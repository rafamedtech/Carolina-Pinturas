import * as z from 'zod'
import { PRODUCT_MANAGEMENT_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../../utils/auth'
import { discardProductWrite } from '../../../utils/managed-products'

export default eventHandler(async (event) => {
  await requireRole(event, PRODUCT_MANAGEMENT_ROLES)
  const input = z.object({ operationId: z.uuid(), productId: z.uuid() }).safeParse(await readBody(event))
  if (!input.success) throw createError({ statusCode: 400, statusMessage: 'Identificador de guardado o producto inválido.' })
  return discardProductWrite(input.data.operationId, input.data.productId)
})
