<script setup lang="ts">
useSeoMeta({ title: 'Inicio' })
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <DashboardNavbar title="Inicio">
        <template #right>
          <UBadge
            label="Semana en curso"
            icon="i-lucide-calendar-days"
            color="neutral"
            variant="subtle"
          />
        </template>
      </DashboardNavbar>
    </template>

    <template #body>
      <HomeDashboard />
    </template>
  </UDashboardPanel>
</template>
