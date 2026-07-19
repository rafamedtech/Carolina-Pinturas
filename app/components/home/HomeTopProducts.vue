<script setup lang="ts">
import type { DashboardTopProduct } from '~/types/dashboard'
import { dashboardCompactCurrency, dashboardNumber } from '~/utils/dashboardFormatters'

defineProps<{
  products: DashboardTopProduct[]
}>()
</script>

<template>
  <UCard :ui="{ header: 'pb-3', body: 'pt-1' }">
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">
            Productos destacados
          </h2>
        </div>
        <UIcon name="i-lucide-trophy" class="size-5 text-warning" />
      </div>
    </template>

    <ol v-if="products.length" class="space-y-5">
      <li v-for="(product, index) in products" :key="product.productId">
        <div class="flex items-start gap-3">
          <UBadge
            :label="String(index + 1)"
            color="neutral"
            variant="subtle"
            size="sm"
            square
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-highlighted">
                  {{ product.name }}
                </p>
                <p class="mt-0.5 truncate text-xs text-muted">
                  {{ product.code }} · {{ dashboardNumber.format(product.quantity) }} uds.
                </p>
              </div>
              <span class="shrink-0 text-sm font-semibold text-highlighted">
                {{ dashboardCompactCurrency.format(product.amount) }}
              </span>
            </div>
            <UProgress
              :model-value="product.percentage"
              color="warning"
              size="xs"
              class="mt-2.5"
            />
          </div>
        </div>
      </li>
    </ol>

    <UEmpty
      v-else
      icon="i-lucide-package-open"
      title="Sin productos vendidos"
      description="Los productos más vendidos aparecerán aquí."
      class="py-12"
    />
  </UCard>
</template>
