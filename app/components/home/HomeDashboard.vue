<script setup lang="ts">
import { dashboardCurrency } from '~/utils/dashboardFormatters'

const { data, status, error, refresh } = useSalesDashboard()

const errorMessage = computed(() =>
  error.value?.data?.statusMessage || 'No fue posible cargar el resumen mensual.'
)

const change = computed(() => data.value?.metrics.salesChangePercentage)
const isPositiveChange = computed(() => (change.value ?? 0) >= 0)
const periodProgress = computed(() => {
  if (!data.value) return 0
  return Math.round((data.value.period.elapsedDays / data.value.period.totalDays) * 100)
})
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      title="Resumen no disponible"
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
      <UPageGrid class="gap-4 lg:grid-cols-3">
        <USkeleton class="h-52 rounded-lg lg:col-span-2" />
        <USkeleton class="h-52 rounded-lg" />
      </UPageGrid>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <USkeleton v-for="index in 4" :key="index" class="h-32 rounded-lg" />
      </div>
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.8fr)]">
        <USkeleton class="h-96 rounded-lg" />
        <USkeleton class="h-96 rounded-lg" />
      </div>
    </template>

    <template v-else-if="data">
      <UPageGrid class="gap-4 lg:grid-cols-3">
        <UPageCard
          title="Ventas del mes"
          description="Pedidos activos y completados; no incluye cotizaciones ni cancelaciones."
          icon="i-lucide-chart-no-axes-combined"
          :badge="{ label: data.period.label, color: 'neutral', variant: 'subtle', class: 'capitalize' }"
          variant="subtle"
          class="lg:col-span-2"
          :ui="{ container: 'gap-y-4' }"
        >
          <div class="flex flex-wrap items-end gap-3">
            <p class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
              {{ dashboardCurrency.format(data.metrics.sales) }}
            </p>
            <UBadge
              v-if="change !== null"
              :label="`${isPositiveChange ? '+' : ''}${change}% vs. mes anterior`"
              :icon="isPositiveChange ? 'i-lucide-trending-up' : 'i-lucide-trending-down'"
              :color="isPositiveChange ? 'success' : 'error'"
              variant="soft"
            />
            <UBadge
              v-else
              label="Sin comparativo anterior"
              icon="i-lucide-minus"
              color="neutral"
              variant="soft"
            />
          </div>
        </UPageCard>

        <UPageCard
          title="Proyección al cierre"
          :description="`Día ${data.period.elapsedDays} de ${data.period.totalDays}`"
          icon="i-lucide-gauge"
          variant="subtle"
          :ui="{ container: 'gap-y-4' }"
        >
          <p class="text-2xl font-semibold tracking-tight text-highlighted">
            {{ dashboardCurrency.format(data.metrics.projectedSales) }}
          </p>
          <UProgress
            :model-value="periodProgress"
            color="primary"
            size="sm"
          />
        </UPageCard>
      </UPageGrid>

      <HomeStats :metrics="data.metrics" />

      <div class="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.75fr)]">
        <HomeChart :data="data.dailySales" :period-label="data.period.label" />
        <HomeTopProducts :products="data.topProducts" />
      </div>

      <HomeBreakdowns
        :payments="data.paymentBreakdown"
        :statuses="data.statusBreakdown"
      />

      <HomeSales :orders="data.recentOrders" />
    </template>
  </div>
</template>
