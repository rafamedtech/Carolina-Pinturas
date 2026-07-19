<script setup lang="ts">
import type { DashboardBreakdownItem } from '~/types/dashboard'
import { dashboardCompactCurrency } from '~/utils/dashboardFormatters'

defineProps<{
  payments: DashboardBreakdownItem[]
  statuses: DashboardBreakdownItem[]
}>()
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <UCard :ui="{ header: 'pb-3', body: 'pt-2' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-highlighted">
              Estado de cobro
            </h2>
          </div>
          <UButton
            label="Ver cobros"
            icon="i-lucide-arrow-up-right"
            trailing
            to="/ventas?payment_status=pendiente_pago"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </div>
      </template>

      <div v-if="payments.length" class="space-y-5">
        <div v-for="item in payments" :key="item.key">
          <div class="mb-2 flex items-center justify-between gap-4">
            <div class="flex min-w-0 items-center gap-2">
              <UBadge
                :label="item.label"
                :color="item.color"
                variant="soft"
                size="sm"
              />
              <UBadge
                :label="String(item.count)"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold text-highlighted">
                {{ dashboardCompactCurrency.format(item.amount) }}
              </p>
              <p class="text-xs text-muted">
                {{ item.percentage }}%
              </p>
            </div>
          </div>
          <UProgress :model-value="item.percentage" :color="item.color" size="sm" />
        </div>
      </div>

      <UEmpty
        v-else
        icon="i-lucide-wallet-cards"
        title="Sin cobros este mes"
        class="py-10"
      />
    </UCard>

    <UCard :ui="{ header: 'pb-3', body: 'pt-2' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-highlighted">
              Pedidos por etapa
            </h2>
          </div>
          <UButton
            label="Ver pedidos"
            icon="i-lucide-arrow-up-right"
            trailing
            to="/ventas"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </div>
      </template>

      <UPageGrid v-if="statuses.length" class="gap-3 sm:grid-cols-2">
        <UPageCard
          v-for="item in statuses"
          :key="item.key"
          :to="`/ventas?status=${item.key}`"
          :title="`${item.count} ${item.count === 1 ? 'pedido' : 'pedidos'}`"
          :description="`${item.percentage}% del mes · ${dashboardCompactCurrency.format(item.amount)}`"
          icon="i-lucide-package-check"
          :badge="{ label: item.label, color: item.color, variant: 'soft' }"
          variant="subtle"
          :ui="{ container: 'gap-y-2 p-4 sm:p-4' }"
        />
      </UPageGrid>

      <UEmpty
        v-else
        icon="i-lucide-package-search"
        title="Sin pedidos este mes"
        class="py-10"
      />
    </UCard>
  </div>
</template>
