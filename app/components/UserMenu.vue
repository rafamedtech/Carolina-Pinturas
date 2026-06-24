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
  [{
    type: 'label',
    label: user.value?.name || 'Usuario',
    description: user.value?.role || ''
  }],
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
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      :label="collapsed ? undefined : user?.name"
      icon="i-lucide-circle-user-round"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed' }"
    />
  </UDropdownMenu>
</template>
