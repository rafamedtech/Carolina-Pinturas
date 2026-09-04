import { canAccessAppPath, homePathForRole } from '~/utils/roleAccess'

export default defineNuxtRouteMiddleware(async (to) => {
  const path = to.path.replace(/\/+$/, '') || '/'
  const publicPaths = new Set(['/lista-precios', '/login', '/recuperar-contrasena'])

  if (path === '/lista-precios') return

  const { disabled, fetchSession } = useAuth()
  const user = await fetchSession()

  if (publicPaths.has(path)) {
    if (user) return navigateTo(homePathForRole(user.role))
    return
  }

  if (!user) {
    return navigateTo(disabled.value ? '/login?reason=disabled' : '/login')
  }

  if (!canAccessAppPath(user.role, path)) {
    return navigateTo(homePathForRole(user.role))
  }

  const adminOnlyPath = path === '/configuracion'
    || path.startsWith('/configuracion/')
    || path === '/reportes'
    || path.startsWith('/reportes/')

  if (adminOnlyPath && user.role !== 'admin') {
    return navigateTo('/')
  }
})
