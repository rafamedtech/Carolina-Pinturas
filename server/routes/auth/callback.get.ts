import { useServerSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'private, no-store')

  const query = getQuery(event)
  const code = typeof query.code === 'string' ? query.code : ''
  const next = query.next === '/actualizar-contrasena'
    ? '/actualizar-contrasena'
    : '/'

  if (!code) {
    return sendRedirect(event, '/login?auth_error=invalid_callback')
  }

  const { error } = await useServerSupabase(event).auth.exchangeCodeForSession(code)

  if (error) {
    return sendRedirect(event, '/login?auth_error=expired_callback')
  }

  return sendRedirect(event, next)
})
