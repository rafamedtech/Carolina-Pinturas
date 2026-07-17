<script setup lang="ts">
useSeoMeta({ title: 'Inicio' })
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Inicio">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Ver ventas"
            icon="i-lucide-list-filter"
            color="neutral"
            variant="ghost"
            to="/ventas"
          />
          <UButton label="Nuevo pedido" icon="i-lucide-plus" to="/ventas/nuevo-pedido" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <HomeDashboard />
    </template>
  </UDashboardPanel>
</template>
