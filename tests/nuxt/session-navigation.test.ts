// @vitest-environment nuxt
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { useRouter, useState } from '#app'
import { expect, it, vi } from 'vitest'
import type { AppUser } from '~/types/siigo'

const { profile } = vi.hoisted(() => ({
  profile: { id: 'test-user', name: 'Administrador', email: 'admin@example.test', role: 'admin', repartidorId: null } satisfies AppUser
}))

vi.mock('~/plugins/supabase.client', async () => {
  const { useState } = await import('#app')
  return {
    default: () => {
      useState<AppUser | null>('auth:user').value = profile
      useState<boolean>('auth:loaded').value = true
      useState<number>('auth:checked-at').value = Date.now()
      return { provide: { supabase: { auth: { onAuthStateChange: vi.fn() } } } }
    }
  }
})

it('navega con la sesión verificada y reacciona a una revocación recibida en segundo plano', async () => {
  const router = useRouter()
  const removeFirst = router.addRoute({ name: 'session-test-first', path: '/prueba-sesion-a', component: { template: '<div />' } })
  const removeSecond = router.addRoute({ name: 'session-test-second', path: '/prueba-sesion-b', component: { template: '<div />' } })
  const response = Promise.withResolvers<{ user: AppUser | null, disabled: boolean }>()
  const sessionRequest = vi.fn(() => response.promise)
  const unregister = registerEndpoint('/api/auth/session', sessionRequest)

  try {
    await router.push('/prueba-sesion-a')
    expect(sessionRequest).not.toHaveBeenCalled()

    useState<number>('auth:checked-at').value = 0
    await router.push('/prueba-sesion-b')
    expect(router.currentRoute.value.path).toBe('/prueba-sesion-b')
    await vi.waitFor(() => expect(sessionRequest).toHaveBeenCalledTimes(1))

    await router.push('/prueba-sesion-a')
    expect(router.currentRoute.value.path).toBe('/prueba-sesion-a')
    expect(sessionRequest).toHaveBeenCalledTimes(1)

    response.resolve({ user: null, disabled: true })
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/login?reason=disabled'))
  } finally {
    response.resolve({ user: profile, disabled: false })
    unregister()
    removeFirst()
    removeSecond()
  }
})
