import type { AppUser } from '~/types/siigo'

interface SessionResponse {
  user: AppUser | null
}

export function useAuth() {
  const user = useState<AppUser | null>('auth:user', () => null)
  const loaded = useState('auth:loaded', () => false)

  async function fetchSession(force = false) {
    if (loaded.value && !force) return user.value

    const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
    const response = await $fetch<SessionResponse>('/api/auth/session', { headers })

    user.value = response.user
    loaded.value = true
    return user.value
  }

  async function login(email: string, password: string) {
    const response = await $fetch<{ user: AppUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    })

    user.value = response.user
    loaded.value = true
    return response.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    loaded.value = true
  }

  return { user, fetchSession, login, logout }
}
