import { sessionRedirect } from '~/utils/roleAccess'

export default defineNuxtRouteMiddleware(async (to) => {
  const path = to.path.replace(/\/+$/, '') || '/'
  if (path === '/lista-precios') return

  const { disabled, fetchSession } = useAuth()
  const user = await fetchSession()
  const redirect = sessionRedirect(path, user?.role, disabled.value)
  if (redirect) return navigateTo(redirect)
})
