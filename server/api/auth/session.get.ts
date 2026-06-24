import { getAppSession } from '../../utils/auth'

export default eventHandler(event => ({ user: getAppSession(event) }))
