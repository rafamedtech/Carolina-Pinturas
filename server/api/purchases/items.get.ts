import { purchaseHistoryFiltersSchema } from '#shared/schemas/purchase'
import { requireRole } from '../../utils/auth'
import { listPurchaseHistory } from '../../utils/purchase-history'

// Muestra costos: solo admin. `requireRole` también deja pasar a `consulta` en GET (lectura global).
export default eventHandler(async (event) => {
  await requireRole(event, ['admin'])
  const parsed = purchaseHistoryFiltersSchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Filtros inválidos.' })
  return listPurchaseHistory(parsed.data)
})
