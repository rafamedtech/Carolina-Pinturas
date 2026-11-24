// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { DropdownMenuItem } from '@nuxt/ui'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { reactive, shallowRef, type ComponentPublicInstance } from 'vue'
import { AuthFormCard, UDropdownMenu, UserMenuBase } from '#components'
import UserMenu from '~/components/UserMenu.vue'
import Login from '~/pages/login.vue'
import RecoverPassword from '~/pages/recuperar-contrasena.vue'

const { login, logout, recover, navigate } = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  recover: vi.fn(),
  navigate: vi.fn()
}))
const user = shallowRef({ name: 'Ana', role: 'admin' })
const colorMode = reactive({ preference: 'dark' })

mockNuxtImport('useAuth', () => () => ({
  user,
  login,
  logout,
  requestPasswordRecovery: recover,
  fetchSession: async () => user.value,
  disabled: shallowRef(false)
}))
mockNuxtImport('useColorMode', () => () => colorMode)
mockNuxtImport('navigateTo', () => navigate)

describe('piloto de acceso de Pinturas', () => {
  it('conserva la identidad, la apariencia y el cierre de sesión en el menú colapsado', async () => {
    const wrapper = await mountSuspended(UserMenu, { props: { collapsed: true } })
    const push = vi.spyOn(wrapper.vm.$router, 'push').mockResolvedValue(undefined)
    try {
      expect(wrapper.get('button').attributes('aria-label')).toBe('Ana')
      const menu = wrapper.getComponent(UDropdownMenu) as unknown as VueWrapper<ComponentPublicInstance<{ items: DropdownMenuItem[][] }>>
      const groups = menu.props('items')
      expect(groups[0]).toEqual([{ type: 'label', label: 'Ana', description: 'admin' }])
      expect(groups.flat()).toContainEqual(expect.objectContaining({ to: '/configuracion' }))

      const light = groups.flat().find(item => item.label === 'Apariencia')?.children?.flat().find(item => item.label === 'Claro')
      expect(light?.checked).toBe(false)
      const event = new Event('select', { cancelable: true })
      light?.onSelect?.(event)
      expect(event.defaultPrevented).toBe(true)
      expect(colorMode.preference).toBe('light')

      user.value = { name: 'Ana', role: 'consulta' }
      await flushPromises()
      expect(menu.props('items').flat()).not.toContainEqual(expect.objectContaining({ to: '/configuracion' }))

      await menu.props('items').flat().find(item => item.label === 'Cerrar sesión')?.onSelect?.(new Event('select'))
      expect(logout).toHaveBeenCalledOnce()
      expect(push).toHaveBeenCalledWith('/login')
      await wrapper.setProps({ collapsed: false })
      expect(wrapper.get('button').text()).toBe('Ana')
    } finally {
      push.mockRestore()
      wrapper.unmount()
      user.value = { name: 'Ana', role: 'admin' }
      colorMode.preference = 'dark'
    }
  })

  it('transmite los cambios de apertura al consumidor', async () => {
    const wrapper = await mountSuspended(UserMenuBase, { props: { items: [], collapsed: true } })
    try {
      expect(wrapper.get('button').attributes('aria-label')).toBe('Menú de usuario')
      const menu = wrapper.getComponent(UDropdownMenu) as unknown as VueWrapper
      menu.vm.$emit('update:open', true)
      expect(wrapper.emitted('update:open')).toEqual([[true]])
    } finally {
      wrapper.unmount()
    }
  })

  it('muestra el error de acceso en la tarjeta y navega al iniciar sesión', async () => {
    login.mockRejectedValueOnce(new Error('Correo o contraseña incorrectos.')).mockResolvedValueOnce(undefined)
    const wrapper = await mountSuspended(Login)
    try {
      expect(wrapper.getComponent(AuthFormCard).get('h1').text()).toBe('Carolina Pinturas')
      await wrapper.get('input[type="email"]').setValue('ana@example.test')
      await wrapper.get('input[type="password"]').setValue('prueba-123')
      await wrapper.get('form').trigger('submit')
      await vi.waitFor(() => expect(wrapper.text()).toContain('Correo o contraseña incorrectos.'))
      expect(navigate).not.toHaveBeenCalled()

      await wrapper.get('form').trigger('submit')
      await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/'))
      expect(login).toHaveBeenLastCalledWith('ana@example.test', 'prueba-123')
    } finally {
      wrapper.unmount()
    }
  })

  it('presenta carga mientras solicita la recuperación y muestra la confirmación', async () => {
    const request = Promise.withResolvers<undefined>()
    recover.mockReturnValueOnce(request.promise)
    const wrapper = await mountSuspended(RecoverPassword)
    try {
      expect(wrapper.getComponent(AuthFormCard).get('h1').text()).toBe('Recuperar contraseña')
      await wrapper.get('input[type="email"]').setValue('ana@example.test')
      await wrapper.get('form').trigger('submit')
      await vi.waitFor(() => expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined())
      expect(recover).toHaveBeenCalledWith('ana@example.test')

      request.resolve(undefined)
      await vi.waitFor(() => expect(wrapper.text()).toContain('Revisa tu correo'))
      expect(wrapper.find('form').exists()).toBe(false)
      expect(wrapper.get('a[href="/login"]').text()).toContain('Volver a iniciar sesión')
    } finally {
      request.resolve(undefined)
      wrapper.unmount()
    }
  })
})
