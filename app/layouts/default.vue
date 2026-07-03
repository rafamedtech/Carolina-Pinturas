<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { UserRole } from '~/types/siigo'

interface AppNavigationItem {
  label: string
  icon: string
  to: string
  roles?: readonly UserRole[]
  onSelect: () => void
}

const open = shallowRef(false)
const { user } = useAuth()
const managementRoles = ['admin', 'mostrador', 'vendedor'] as const satisfies readonly UserRole[]
const orderEntryRoles = [...managementRoles, 'repartidor'] as const satisfies readonly UserRole[]
const allLinks: AppNavigationItem[] = [{
  label: 'Inicio',
  icon: 'i-lucide-house',
  to: '/',
  roles: managementRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Productos',
  icon: 'i-lucide-package',
  to: '/productos',
  roles: managementRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Clientes',
  icon: 'i-lucide-users',
  to: '/clientes',
  roles: managementRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Pedidos',
  icon: 'i-lucide-shopping-cart',
  to: '/ventas',
  roles: orderEntryRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Igualaciones',
  icon: 'i-lucide-palette',
  to: '/igualaciones',
  roles: [...managementRoles, 'igualaciones'],
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Repartidores',
  icon: 'i-lucide-truck',
  to: '/repartidores',
  roles: managementRoles,
  onSelect: () => {
    open.value = false
  }
}]

const links = computed(() => [
  allLinks
    .filter(link => !link.roles || (user.value && link.roles.includes(user.value.role)))
    .map(({ roles: _roles, ...link }) => link)
] satisfies NavigationMenuItem[][])

const groups = computed(() => [{
  id: 'links',
  label: 'Ir a',
  items: links.value.flat().map(link => ({
    label: link.label,
    icon: link.icon,
    to: link.to
  }))
}])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <TeamsMenu :collapsed="collapsed" />
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="links[0]"
          orientation="vertical"
          tooltip
          popover
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />
  </UDashboardGroup>
</template>
