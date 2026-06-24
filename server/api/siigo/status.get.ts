import { requireUser } from '../../utils/auth'
import { siigoConfigured } from '../../utils/siigo'

export default eventHandler((event) => {
  requireUser(event)
  return { configured: siigoConfigured() }
})
