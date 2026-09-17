import { purchaseCreateSchema } from '#shared/schemas/purchase'
import { requireRole } from '../../utils/auth'
import { createPurchase } from '../../utils/purchases'

export default eventHandler(async (event) => {
  const user = await requireRole(event, ['admin'])
  const input = purchaseCreateSchema.safeParse(await readBody(event))
  if (!input.success) throw createError({ statusCode: 400, statusMessage: 'Revisa proveedor, fecha, cantidades y costos.', data: input.error.flatten() })
  return createPurchase(input.data, user)
})
