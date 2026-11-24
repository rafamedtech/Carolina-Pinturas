<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const router = useRouter()
const { user, logout } = useAuth()

async function signOut() {
  await logout()
  await router.push('/login')
}

const items = computed<DropdownMenuItem[][]>(() => [
  ...(user.value?.role === 'admin'
    ? [[{
        label: 'Configuración',
        icon: 'i-lucide-settings',
        to: '/configuracion'
      }]]
    : []),
  [{
    label: 'Apariencia',
    icon: 'i-lucide-sun-moon',
    children: [{
      label: 'Claro',
      icon: 'i-lucide-sun',
      type: 'checkbox',
      checked: colorMode.preference === 'light',
      onSelect(e: Event) {
        e.preventDefault()
        colorMode.preference = 'light'
      }
    }, {
      label: 'Oscuro',
      icon: 'i-lucide-moon',
      type: 'checkbox',
      checked: colorMode.preference === 'dark',
      onSelect(e: Event) {
        e.preventDefault()
        colorMode.preference = 'dark'
      }
    }]
  }],
  [{
    label: 'Cerrar sesión',
    icon: 'i-lucide-log-out',
    onSelect: signOut
  }]
])
</script>

<template>
  <UserMenuBase
    :name="user?.name || undefined"
    :description="user?.role"
    :items="items"
    :collapsed="collapsed"
    icon="i-lucide-circle-user-round"
    :button-ui="{ trailingIcon: 'text-dimmed' }"
  />
</template>
