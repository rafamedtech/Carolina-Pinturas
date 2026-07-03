import type { AppUser } from '~/types/siigo'
import { clearStaleSupabaseAuthCookies } from '~/utils/supabaseCookies'

interface SessionResponse {
  user: AppUser | null
  disabled: boolean
}

let authListenerStarted = false

export function useAuth() {
  const user = useState<AppUser | null>('auth:user', () => null)
  const loaded = useState('auth:loaded', () => false)
  const disabled = useState('auth:disabled', () => false)
  const nuxtApp = useNuxtApp()
  const config = useRuntimeConfig()

  function browserSupabase() {
    if (import.meta.server) {
      throw new Error('El cliente de Supabase Auth sólo está disponible en el navegador.')
    }

    return nuxtApp.$supabase
  }

  async function fetchSession(force = false) {
    if (loaded.value && !force) return user.value

    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const response = await $fetch<SessionResponse>('/api/auth/session', { headers })

    user.value = response.user
    disabled.value = response.disabled
    loaded.value = true
    return user.value
  }

  async function login(email: string, password: string) {
    const supabase = browserSupabase()
    clearStaleSupabaseAuthCookies(config.public.supabaseUrl)
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      throw new Error('Correo o contraseña incorrectos.')
    }

    const appUser = await fetchSession(true)

    if (!appUser) {
      await supabase.auth.signOut({ scope: 'local' })
      throw new Error(disabled.value
        ? 'Tu usuario no está habilitado para acceder al panel.'
        : 'No se encontró el perfil interno de tu usuario.')
    }

    return appUser
  }

  async function logout(scope: 'global' | 'local' = 'local') {
    await browserSupabase().auth.signOut({ scope })
    user.value = null
    disabled.value = false
    loaded.value = true
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
    browserSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        user.value = null
        disabled.value = false
        loaded.value = true
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        window.setTimeout(() => {
          void fetchSession(true).catch(() => {
            user.value = null
            loaded.value = true
          })
        }, 0)
      }
    })
  }

  return {
    user: readonly(user),
    loaded: readonly(loaded),
    disabled: readonly(disabled),
    fetchSession,
    login,
    logout,
    requestPasswordRecovery,
    updatePassword
  }
}
