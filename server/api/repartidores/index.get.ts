import { requireUser } from '../../utils/auth'
import { listRepartidores } from '../../utils/repartidores'

export default eventHandler(async (event) => {
  requireUser(event)
  const query = getQuery(event)

  return listRepartidores({ onlyActive: query.all !== 'true' })
})
