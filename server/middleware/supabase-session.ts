import { getVerifiedSupabaseClaims } from '../utils/supabase'

const SESSION_REFRESH_EXCLUDED_PATHS = new Set([
  '/favicon.ico',
  '/carolina-logo.jpg',
  '/logo-pinturas.png',
  '/lista-precios'
])

function shouldSkipSessionRefresh(pathname: string) {
  return SESSION_REFRESH_EXCLUDED_PATHS.has(pathname)
    || pathname.startsWith('/_nuxt/')
    || pathname.startsWith('/__nuxt')
    || pathname.startsWith('/_ipx/')
}

export default defineEventHandler(async (event) => {
  const pathname = getRequestURL(event).pathname.replace(/\/+$/, '') || '/'

  if (shouldSkipSessionRefresh(pathname)) return

  setHeader(event, 'Cache-Control', 'private, no-store')

  if (getCookie(event, 'carolina_pinturas_session')) {
    deleteCookie(event, 'carolina_pinturas_session', { path: '/' })
  }

  await getVerifiedSupabaseClaims(event)
})
