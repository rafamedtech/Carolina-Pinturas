import * as z from 'zod'
import { purchaseCommandSchema } from '#shared/schemas/purchase'
import { requireRole } from '../../../utils/auth'
import { mutatePurchase } from '../../../utils/purchases'

export default eventHandler(async (event) => {
  const user = await requireRole(event, ['admin'])
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const input = purchaseCommandSchema.safeParse(await readBody(event))
  if (!id.success || !input.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los datos de la operación.' })
  return mutatePurchase(id.data, input.data, user)
})
