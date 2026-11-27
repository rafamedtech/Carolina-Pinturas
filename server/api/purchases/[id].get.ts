import * as z from 'zod'
import { requireRole } from '../../utils/auth'
import { getPurchase, purchaseView } from '../../utils/purchases'
import { purchaseViewForRole } from '../../utils/purchase-visibility'
import { PURCHASE_RECEIPT_ROLES } from '~/utils/roleAccess'

export default eventHandler(async (event) => {
  const user = await requireRole(event, PURCHASE_RECEIPT_ROLES)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, statusMessage: 'Identificador inválido.' })
  return purchaseViewForRole(purchaseView(await getPurchase(id.data)), user.role)
})
