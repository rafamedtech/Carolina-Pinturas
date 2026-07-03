import { requireRole } from '../../utils/auth'
import { siigoConfigured } from '../../utils/siigo'

export default eventHandler(async (event) => {
  await requireRole(event, ['admin'])
  return { configured: siigoConfigured() }
})
