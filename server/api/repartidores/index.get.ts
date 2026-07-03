import { ORDER_ENTRY_ROLES } from '~/utils/roleAccess'
import { requireRole } from '../../utils/auth'
import { listRepartidores } from '../../utils/repartidores'

export default eventHandler(async (event) => {
  await requireRole(event, ORDER_ENTRY_ROLES)
  const query = getQuery(event)

  return listRepartidores({ onlyActive: query.all !== 'true' })
})
