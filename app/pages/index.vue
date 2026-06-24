<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Inicio">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            label="Productos"
            icon="i-lucide-package"
            color="neutral"
            variant="ghost"
            to="/productos"
          />
          <UButton label="Clientes" icon="i-lucide-users" to="/clientes" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <HomeStats />
      <HomeSales />
    </template>
  </UDashboardPanel>
</template>
