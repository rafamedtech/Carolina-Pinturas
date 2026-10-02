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
          <UBadge
            label="Semana en curso"
            icon="i-lucide-calendar-days"
            color="neutral"
            variant="subtle"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <HomeDashboard />
    </template>
  </UDashboardPanel>
</template>
