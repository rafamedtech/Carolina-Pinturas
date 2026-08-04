<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'

useSeoMeta({ title: 'Inicio' })

const now = new Date()
const selectedMonth = shallowRef(new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1))
const month = computed(() => `${selectedMonth.value.year}-${String(selectedMonth.value.month).padStart(2, '0')}`)
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Inicio">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <HomeMonthPicker v-model="selectedMonth" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <HomeDashboard :month="month" />
    </template>
  </UDashboardPanel>
</template>
