<script setup lang="ts">
import { tableQueryField, tableQueryDate } from '~/utils/tableQuery'
import { CalendarDate } from '@internationalized/date'

const now = new Date()
const view = shallowRef<'monthly' | 'annual'>('monthly')
const title = computed(() => view.value === 'annual' ? 'Reporte anual' : 'Reporte mensual')
useSeoMeta({ title: () => title.value })
const selectedMonth = shallowRef(new CalendarDate(now.getFullYear(), now.getMonth() + 1, 1))
const defaultMonth = selectedMonth.value
useTableQuery([tableQueryField('view', view, {
  parse: value => value === 'annual' ? 'annual' : 'monthly',
  serialize: value => value === 'annual' ? value : undefined
}), tableQueryField('month', selectedMonth, {
  parse: (value) => {
    const date = tableQueryDate.parse(typeof value === 'string' ? `${value}-01` : '')
    return date ? new CalendarDate(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 1) : defaultMonth
  },
  serialize: value => `${value.year}-${String(value.month).padStart(2, '0')}`
})])
const month = computed(() => `${selectedMonth.value.year}-${String(selectedMonth.value.month).padStart(2, '0')}`)
</script>

<template>
  <UDashboardPanel id="reports">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <HomeMonthPicker v-model="selectedMonth" :type="view === 'annual' ? 'year' : 'month'" />
          <UButton
            :label="view === 'annual' ? 'Anual' : 'Mensual'"
            icon="i-lucide-calendar-range"
            :color="view === 'annual' ? 'primary' : 'neutral'"
            :variant="view === 'annual' ? 'soft' : 'outline'"
            :aria-pressed="view === 'annual'"
            :aria-label="view === 'annual' ? 'Cambiar a vista mensual' : 'Cambiar a vista anual'"
            @click="view = view === 'annual' ? 'monthly' : 'annual'"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <ReportsDashboard :month="month" :view="view" />
    </template>
  </UDashboardPanel>
</template>
