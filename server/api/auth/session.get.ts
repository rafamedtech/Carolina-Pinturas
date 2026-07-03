import { getAppSession } from '../../utils/auth'

export default eventHandler(async (event) => {
  try {
    return {
      user: await getAppSession(event),
      disabled: false
    }
  } catch (error: unknown) {
    if (isError(error) && error.statusCode === 403) {
      return {
        user: null,
        disabled: true
      }
    }

    throw error
  }
})
