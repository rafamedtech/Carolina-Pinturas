<script setup lang="ts">
import { tableQueryField, tableQueryDate } from '~/utils/tableQuery'
import { CalendarDate } from '@internationalized/date'
import ReportsPeriodControls from '~/components/reports/ReportsPeriodControls.vue'

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
      <DetailHeader :title="title" :show-refresh="false">
        <template #actions>
          <ReportsPeriodControls v-model:month="selectedMonth" v-model:view="view" />
        </template>
      </DetailHeader>
    </template>

    <template #body>
      <ReportsDashboard :month="month" :view="view" />
    </template>
  </UDashboardPanel>
</template>
