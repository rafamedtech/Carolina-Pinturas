<script setup lang="ts">
import { navigationIcons } from '~/utils/navigationIcons'
import type { NavigationMenuItem } from '@nuxt/ui'
import type { UserRole } from '~/types/siigo'
import { PURCHASE_RECEIPT_ROLES } from '~/utils/roleAccess'

interface AppNavigationItem {
  label: string
  icon: string
  to: string
  roles?: readonly UserRole[]
  onSelect: () => void
}

const open = shallowRef(false)
const { user } = useAuth()
const adminRoles = ['admin'] as const satisfies readonly UserRole[]
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
  label: 'Reportes',
  icon: 'i-lucide-chart-column-big',
  to: '/reportes',
  roles: adminRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Productos',
  icon: navigationIcons['/productos'],
  to: '/productos',
  roles: managementRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Inventario',
  icon: navigationIcons['/inventario'],
  to: '/inventario',
  roles: managementRoles,
  onSelect: () => { open.value = false }
}, {
  label: 'Clientes y proveedores',
  icon: navigationIcons['/clientes'],
  to: '/clientes',
  roles: managementRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Pedidos',
  icon: navigationIcons['/ventas'],
  to: '/ventas',
  roles: orderEntryRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Pagos',
  icon: 'i-lucide-hand-coins',
  to: '/pagos',
  roles: managementRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Compras',
  icon: navigationIcons['/compras'],
  to: '/compras',
  roles: PURCHASE_RECEIPT_ROLES,
  onSelect: () => { open.value = false }
}, {
  label: 'Gastos',
  icon: 'i-lucide-receipt-text',
  to: '/gastos',
  roles: managementRoles,
  onSelect: () => {
    open.value = false
  }
}, {
  label: 'Igualaciones',
  icon: navigationIcons['/igualaciones'],
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
    .filter(link => !link.roles || (user.value && (link.roles.includes(user.value.role) || user.value.role === 'consulta')))
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
  <DashboardShell
    v-model:open="open"
    sidebar-id="default"
    sidebar-class="bg-elevated/25"
    :items="links[0]"
    :groups="groups"
    :navigation-ui="{
      link: 'text-base lg:text-sm',
      linkLeadingIcon: 'size-6 lg:size-5'
    }"
  >
    <template #header="{ collapsed }">
      <TeamsMenu :collapsed="collapsed" />
    </template>
    <template #footer="{ collapsed }">
      <UserMenu :collapsed="collapsed" />
    </template>
    <slot />
  </DashboardShell>
</template>
