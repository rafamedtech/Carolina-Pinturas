import * as z from 'zod'
import { purchaseCommandSchema } from '#shared/schemas/purchase'
import { requireRole } from '../../../utils/auth'
import { mutatePurchase } from '../../../utils/purchases'
import { purchaseViewForRole } from '../../../utils/purchase-visibility'
import { canManagePurchases, PURCHASE_RECEIPT_ROLES } from '~/utils/roleAccess'

export default eventHandler(async (event) => {
  const user = await requireRole(event, PURCHASE_RECEIPT_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  const input = purchaseCommandSchema.safeParse(await readBody(event))
  if (!id.success || !input.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los datos de la operación.' })
  // Mostrador solo registra recepciones; anularlas y el resto de acciones son de admin.
  if (!canManagePurchases(user.role) && input.data.command.action !== 'receive') {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para esta operación de compra.' })
  }
  return purchaseViewForRole(await mutatePurchase(id.data, input.data, user), user.role)
})
