import { clearAppSession } from '../../utils/auth'

export default eventHandler((event) => {
  clearAppSession(event)
  return { ok: true }
})
