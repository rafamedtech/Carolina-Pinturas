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
    <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-default pb-5">
      <div class="max-w-2xl">
        <p class="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
          Lectura ejecutiva
        </p>
        <h1 class="mt-1.5 text-2xl font-semibold tracking-tight text-highlighted sm:text-3xl">
          Pulso del negocio
        </h1>
        <p class="mt-2 text-sm text-muted">
          Ventas, liquidez y concentración comercial para tomar decisiones con datos reales.
        </p>
      </div>
      <UBadge
        v-if="data"
        :label="data.period.label"
        icon="i-lucide-calendar-range"
        color="neutral"
        variant="subtle"
        size="lg"
        class="capitalize"
      />
    </div>

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

    <template v-if="status === 'pending' && !data">
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

    <template v-else-if="data">
      <ReportsSummaryCards :metrics="data.metrics" />
      <ReportsCashFlowChart :data="data.dailyMovements" />
      <ReportsBreakdowns
        :payment-methods="data.paymentMethods"
        :expense-categories="data.expenseCategories"
      />
      <ReportsRankings
        :customers="data.topCustomers"
        :products="data.topProducts"
        :sellers="data.topSellers"
      />

      <div class="flex gap-3 rounded-lg border border-default bg-elevated/40 p-4">
        <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-dimmed" />
        <div>
          <p class="text-sm font-medium text-default">
            Cómo leer este reporte
          </p>
          <p class="mt-1 text-sm text-balance text-muted">
            Las ventas corresponden a la fecha del pedido; los cobros, a la fecha en que se recibió el pago, incluso si pertenecen a ventas de otro mes. El saldo por cobrar refleja el saldo vigente de los pedidos del periodo. El flujo neto es cobros menos gastos y no representa utilidad, porque el sistema no registra el costo de venta.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>
