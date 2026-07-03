import { getVerifiedSupabaseClaims } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname.replace(/\/+$/, '') || '/'

  if (pathname === '/lista-precios') return

  setHeader(event, 'Cache-Control', 'private, no-store')

  if (getCookie(event, 'carolina_pinturas_session')) {
    deleteCookie(event, 'carolina_pinturas_session', { path: '/' })
  }

  await getVerifiedSupabaseClaims(event)
})
