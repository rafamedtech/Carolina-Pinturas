<script setup lang="ts">
import { dashboardNumber } from '~/utils/dashboardFormatters'
import { reportCurrency } from '~/utils/reportPeriods'

const props = defineProps<{
  month: string
}>()

const { data, status, error, refresh } = useBusinessReports(toRef(props, 'month'))
const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible generar los reportes del periodo.'
)

function plural(count: number, singular: string, pluralLabel: string) {
  return `${dashboardNumber.format(count)} ${count === 1 ? singular : pluralLabel}`
}
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

    <template v-if="['idle', 'pending'].includes(status)">
      <USkeleton class="h-6 w-48 rounded-md" />
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="index in 4" :key="index" class="h-36 rounded-xl" />
      </div>
      <div class="grid gap-4 xl:grid-cols-3">
        <USkeleton class="h-80 rounded-lg xl:col-span-2" />
        <USkeleton class="h-80 rounded-lg" />
      </div>
      <USkeleton class="h-96 rounded-lg" />
      <div class="grid gap-4 xl:grid-cols-3">
        <USkeleton v-for="index in 3" :key="index" class="h-80 rounded-lg" />
      </div>
    </template>

    <template v-else-if="data && !error">
      <section aria-labelledby="reports-summary" class="space-y-3">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="reports-summary" class="text-lg font-semibold tracking-tight text-highlighted">
            Resultado del mes
          </h2>
          <p class="text-xs text-muted">
            {{ data.period.label }} · importes en MXN antes de IVA
          </p>
        </div>
        <ReportsSummaryCards :metrics="data.metrics" />
        <div class="grid gap-4 xl:grid-cols-3">
          <ReportsProfitStatement :metrics="data.metrics" class="xl:col-span-2" />
          <ReportsMonthPace :report="data" />
        </div>
        <ReportsCashFlowChart :data="data.dailyMovements" />
      </section>

      <section aria-labelledby="reports-sales" class="space-y-3">
        <SectionHeading
          id="reports-sales"
          title="Ventas"
          marker="bg-primary"
          :amount="data.metrics.sales"
        />
        <ReportsSalesChannels :channels="data.salesChannels" :metrics="data.metrics" />
        <ReportsPeriodAnalysis :report="data" />
        <div class="grid gap-4 xl:grid-cols-3">
          <ReportsBreakdownCard
            title="Ventas por línea"
            description="Línea de producto en Siigo."
            icon="i-lucide-paint-bucket"
            color="primary"
            :items="data.salesByLine"
            empty-icon="i-lucide-paint-bucket"
            empty-title="Sin ventas"
            :count-label="count => plural(count, 'partida', 'partidas')"
          />
          <ReportsRankingCard
            title="Productos destacados"
            description="Productos con mayor venta del periodo."
            icon="i-lucide-package-open"
            empty="Sin productos vendidos"
            :items="data.topProducts"
            :count-label="count => `${dashboardNumber.format(count)} uds.`"
          />
          <ReportsRankingCard
            title="Clientes principales"
            description="Concentración de ventas por cliente."
            icon="i-lucide-users"
            empty="Sin clientes con ventas"
            :items="data.topCustomers"
            :count-label="count => plural(count, 'pedido', 'pedidos')"
          />
        </div>
      </section>

      <section aria-labelledby="reports-materials" class="space-y-3">
        <SectionHeading
          id="reports-materials"
          title="Compras de material"
          marker="bg-violet-500"
          :amount="data.metrics.materialPurchases"
        />
        <div class="grid gap-4 xl:grid-cols-3">
          <ReportsRankingCard
            title="Proveedores de material"
            description="Pagos a proveedores registrados en el mes."
            icon="i-lucide-truck"
            empty="Sin compras de material en este mes"
            :items="data.topMaterialProviders"
            :count-label="count => plural(count, 'pago', 'pagos')"
            color="material"
            exact-amounts
            class="xl:col-span-2"
          />
          <ReportsPurchaseInvoices :totals="data.metrics.purchaseInvoiceTotals" />
        </div>
      </section>

      <section aria-labelledby="reports-operating" class="space-y-3">
        <SectionHeading
          id="reports-operating"
          title="Gastos operativos"
          marker="bg-warning"
          :amount="data.metrics.operatingExpenses"
        />
        <ReportsBreakdownCard
          title="Gastos operativos por categoría"
          description="Renta, nómina, servicios y demás costos de operar, sin compras de material."
          icon="i-lucide-chart-pie"
          color="warning"
          :items="data.operatingExpenseCategories"
          empty-icon="i-lucide-receipt"
          empty-title="Sin gastos operativos"
          :count-label="count => plural(count, 'gasto', 'gastos')"
        >
          <template #footer>
            <ReportsExpenseDetails :expenses="data.expenseDetails" :period-label="data.period.label" />
          </template>
        </ReportsBreakdownCard>
      </section>

      <section aria-labelledby="reports-collections" class="space-y-3">
        <SectionHeading
          id="reports-collections"
          title="Cobranza y flujo"
          marker="bg-success"
          :amount="data.metrics.collections"
        />
        <div class="grid gap-4 xl:grid-cols-2">
          <ReportsRankingCard
            title="Saldo por cobrar"
            description="Saldo vigente de pedidos del mes."
            icon="i-lucide-hourglass"
            empty="Sin clientes con adeudo en este mes"
            :items="data.topDebtors"
            :count-label="count => plural(count, 'pedido con saldo', 'pedidos con saldo')"
            exact-amounts
          >
            <template #summary>
              <dl class="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-elevated/60 p-3">
                <div>
                  <dt class="text-xs text-muted">
                    Pendiente
                  </dt>
                  <dd class="mt-0.5 font-semibold tabular-nums text-highlighted">
                    {{ reportCurrency.format(data.metrics.outstandingBalance) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">
                    Cobrado
                  </dt>
                  <dd class="mt-0.5 font-semibold tabular-nums text-highlighted">
                    {{ reportCurrency.format(data.metrics.collections) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">
                    Flujo neto
                  </dt>
                  <dd class="mt-0.5 font-semibold tabular-nums" :class="data.metrics.netCashFlow < 0 ? 'text-error' : 'text-highlighted'">
                    {{ reportCurrency.format(data.metrics.netCashFlow) }}
                  </dd>
                </div>
              </dl>
              <p class="mb-4 text-xs text-muted tabular-nums">
                {{ dashboardNumber.format(data.metrics.collectionCoveragePercentage) }}% de los pedidos del mes ya está cubierto. El flujo neto resta todos los egresos a lo cobrado.
              </p>
              <p v-if="data.topDebtors.length" class="mb-2 text-xs font-medium text-muted">
                Clientes con mayor adeudo
              </p>
            </template>
          </ReportsRankingCard>
          <ReportsBreakdownCard
            title="Cobros por método"
            description="Cómo entra el dinero al negocio."
            icon="i-lucide-wallet-cards"
            color="success"
            :items="data.paymentMethods"
            empty-icon="i-lucide-hand-coins"
            empty-title="Sin cobros"
            :count-label="count => plural(count, 'movimiento', 'movimientos')"
          />
        </div>
      </section>
    </template>
  </div>
</template>
