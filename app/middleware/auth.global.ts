export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/lista-precios') return

  const { fetchSession } = useAuth()
  const user = await fetchSession()

  if (to.path === '/login') {
    if (user) return navigateTo('/')
    return
  }

  if (!user) return navigateTo('/login')

  if (to.path.startsWith('/configuracion') && user.role !== 'admin') {
    return navigateTo('/')
  }
})
