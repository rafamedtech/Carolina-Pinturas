import * as z from 'zod'
import { findUserByCredentials, setSession } from '../../utils/auth'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200)
})

export default eventHandler(async (event) => {
  const parsed = schema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Correo o contraseña inválidos.' })
  }

  const user = findUserByCredentials(parsed.data.email, parsed.data.password)

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Correo o contraseña incorrectos.' })
  }

  setSession(event, user)
  return { user }
})
