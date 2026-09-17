import * as z from 'zod'
import { requireRole } from '../../utils/auth'
import { getPurchase, purchaseView } from '../../utils/purchases'

export default eventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw createError({ statusCode: 400, statusMessage: 'Identificador inválido.' })
  return purchaseView(await getPurchase(id.data))
})
