<script setup lang="ts">
const props = defineProps<{
  month: string
}>()

const { data, status, error, refresh } = useBusinessReports(toRef(props, 'month'))
const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible generar los reportes del periodo.'
)
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      title="Reportes no disponibles"
      :description="errorMessage"
      icon="i-lucide-cloud-alert"
    >
      <template #actions>
        <UButton
          label="Reintentar"
          color="warning"
          variant="soft"
          size="sm"
          icon="i-lucide-refresh-cw"
          @click="() => refresh()"
        />
      </template>
    </UAlert>

    <template v-if="status === 'pending'">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="index in 4" :key="index" class="h-36 rounded-lg" />
      </div>
      <USkeleton class="h-28 rounded-lg" />
      <USkeleton class="h-96 rounded-lg" />
      <div class="grid gap-4 xl:grid-cols-2">
        <USkeleton v-for="index in 2" :key="index" class="h-80 rounded-lg" />
      </div>
      <div class="grid gap-4 xl:grid-cols-3">
        <USkeleton v-for="index in 3" :key="index" class="h-80 rounded-lg" />
      </div>
    </template>

    <template v-else-if="data && !error">
      <ReportsSummaryCards :metrics="data.metrics" />
      <ReportsPeriodAnalysis :report="data" />
      <ReportsSalesChannels :channels="data.salesChannels" />
      <ReportsCashFlowChart :data="data.dailyMovements" />
      <ReportsBreakdowns
        :payment-methods="data.paymentMethods"
        :expense-categories="data.expenseCategories"
      />
      <ReportsRankings
        :customers="data.topCustomers"
        :products="data.topProducts"
        :debtors="data.topDebtors"
      />
    </template>
  </div>
</template>
