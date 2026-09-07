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

      <div class="flex gap-3 rounded-lg border border-default bg-elevated/40 p-4">
        <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-dimmed" />
        <div>
          <p class="text-sm font-medium text-default">
            Cómo leer este reporte
          </p>
          <p class="mt-1 text-sm text-balance text-muted">
            Todos los importes se presentan en MXN. Se excluyen borradores y pedidos cancelados. Mostrador corresponde a los clientes “MOSTRADOR” y “MOSTRADOR .”; todos los demás se agrupan como clientes del vendedor. Las ventas corresponden a la fecha del pedido; los cobros, a la fecha en que se recibió el pago, incluso si pertenecen a ventas de otro mes. El saldo por cobrar refleja el saldo vigente de los pedidos del periodo. El flujo neto es cobros menos gastos y no representa utilidad, porque el sistema no registra el costo de venta.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
