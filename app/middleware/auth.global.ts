export default defineNuxtRouteMiddleware(async (to) => {
  const path = to.path.replace(/\/+$/, '') || '/'
  const publicPaths = new Set(['/lista-precios', '/login', '/recuperar-contrasena'])

  if (path === '/lista-precios') return

  const { disabled, fetchSession } = useAuth()
  const user = await fetchSession()

  if (publicPaths.has(path)) {
    if (user) return navigateTo('/')
    return
  }

  if (!user) {
    return navigateTo(disabled.value ? '/login?reason=disabled' : '/login')
  }

  if (to.path.startsWith('/configuracion') && user.role !== 'admin') {
    return navigateTo('/')
  }
})
