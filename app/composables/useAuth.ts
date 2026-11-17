import { canWriteData, isPublicAppPath, sessionRedirect } from '~/utils/roleAccess'
import type { AppUser } from '~/types/siigo'
import { clearStaleSupabaseAuthCookies } from '~/utils/supabaseCookies'

interface SessionResponse {
  user: AppUser | null
  disabled: boolean
}

const SESSION_REVALIDATE_INTERVAL = 60_000
let authListenerStarted = false
let pendingSession: { controller: AbortController, promise: Promise<AppUser | null> } | undefined

function cancelPendingSession() {
  pendingSession?.controller.abort()
  pendingSession = undefined
}

export function useAuth() {
  const user = useState<AppUser | null>('auth:user', () => null)
  const loaded = useState('auth:loaded', () => false)
  const disabled = useState('auth:disabled', () => false)
  const checkedAt = useState('auth:checked-at', () => 0)
  const nuxtApp = useNuxtApp()
  const config = useRuntimeConfig()

  function browserSupabase() {
    if (import.meta.server) {
      throw new Error('El cliente de Supabase Auth sólo está disponible en el navegador.')
    }

    return nuxtApp.$supabase
  }

  async function loadSession(signal?: AbortSignal) {
    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const response = await $fetch<SessionResponse>('/api/auth/session', { headers, signal })
    if (signal?.aborted) return user.value

    user.value = response.user
    disabled.value = response.disabled
    checkedAt.value = Date.now()
    loaded.value = true
    return user.value
  }

  async function fetchSession(force = false) {
    if (loaded.value && !force) return user.value
    if (import.meta.server) return loadSession()
    if (pendingSession) return pendingSession.promise

    const controller = new AbortController()
    const promise = loadSession(controller.signal).finally(() => {
      if (pendingSession?.controller === controller) pendingSession = undefined
    })
    pendingSession = { controller, promise }
    return promise
  }

  function clearSession() {
    cancelPendingSession()
    user.value = null
    disabled.value = false
    loaded.value = true
  }

  async function login(email: string, password: string) {
    const supabase = browserSupabase()
    clearStaleSupabaseAuthCookies(config.public.supabaseUrl)
    cancelPendingSession()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw new Error('Correo o contraseña incorrectos.')
    }

    const appUser = await fetchSession(true)

    if (!appUser) {
      const message = disabled.value
        ? 'Tu usuario no está habilitado para acceder al panel.'
        : 'No se encontró el perfil interno de tu usuario.'
      await supabase.auth.signOut({ scope: 'local' })
      throw new Error(message)
    }

    return appUser
  }

  async function logout(scope: 'global' | 'local' = 'local') {
    await browserSupabase().auth.signOut({ scope })
    clearSession()
  }

  async function requestPasswordRecovery(email: string) {
    const redirectTo = `${window.location.origin}/auth/callback?next=/actualizar-contrasena`
    await browserSupabase().auth.resetPasswordForEmail(email, { redirectTo })
  }

  async function updatePassword(password: string) {
    const { error } = await browserSupabase().auth.updateUser({ password })

    if (error) throw error

    await logout('global')
  }

  if (import.meta.client && !authListenerStarted) {
    authListenerStarted = true
    const router = useRouter()

    async function revalidateSession() {
      try {
        await fetchSession(true)
      } catch {
        // Keep the last verified profile if the network fails.
        return
      }

      const path = router.currentRoute.value.path.replace(/\/+$/, '') || '/'
      if (isPublicAppPath(path)) return

      const redirect = sessionRedirect(path, user.value?.role, disabled.value)
      if (redirect) await router.replace(redirect)
    }

    router.afterEach((to, from, failure) => {
      const path = to.path.replace(/\/+$/, '') || '/'
      if (failure || to.path === from.path || isPublicAppPath(path) || !user.value) return
      if (Date.now() - checkedAt.value < SESSION_REVALIDATE_INTERVAL) return

      void revalidateSession().catch(() => {})
    })

    browserSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearSession()
        return
      }

      if (event === 'SIGNED_IN' && session?.user.id === user.value?.id) return
      if (event === 'SIGNED_IN' && user.value) cancelPendingSession()

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        window.setTimeout(() => {
          void revalidateSession().catch(() => {})
        }, 0)
      }
    })
  }

  return {
    user: readonly(user),
    canWrite: computed(() => canWriteData(user.value?.role)),
    loaded: readonly(loaded),
    disabled: readonly(disabled),
    fetchSession,
    login,
    logout,
    requestPasswordRecovery,
    updatePassword
  }
}
