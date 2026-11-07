<script setup lang="ts">
import type { ReportInventoryValuation } from '~/types/reports'
import { purchaseMoney } from '~/utils/purchaseFormat'

defineProps<{ valuation: ReportInventoryValuation }>()
</script>

<template>
  <section aria-labelledby="reports-inventory" class="space-y-3">
    <ReportsSectionHeading
      id="reports-inventory"
      title="Valor actual de la mercancía"
      marker="bg-info"
    />
    <div class="grid gap-4 xl:grid-cols-3">
      <UCard :ui="{ header: 'pb-3', body: 'pt-4' }">
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-highlighted">
                Total general
              </h3>
              <p class="mt-1 text-sm text-muted">
                Existencias físicas de todos los almacenes, incluidas las reservas, al último costo unitario registrado.
              </p>
            </div>
            <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
              <UIcon name="i-lucide-package" class="size-4" aria-hidden="true" />
            </span>
          </div>
        </template>

        <dl v-if="valuation.totals.length" class="divide-y divide-default">
          <div v-for="total in valuation.totals" :key="total.currencyCode" class="py-3 first:pt-0 last:pb-0">
            <dt class="text-xs font-medium tracking-wide text-muted uppercase">
              {{ total.currencyCode }}
            </dt>
            <dd class="mt-1 text-xl font-semibold tabular-nums text-highlighted">
              {{ purchaseMoney(total.amount, total.currencyCode) }}
            </dd>
          </div>
        </dl>
        <p v-else class="text-sm text-muted">
          Sin importe.
        </p>
      </UCard>
      <UCard :ui="{ header: 'pb-3', body: 'pt-4' }" class="min-w-0 xl:col-span-2">
        <template #header>
          <div class="flex items-start justify-between gap-3">
            <h3 class="text-base font-semibold text-highlighted">
              Detalle por almacén
            </h3>
            <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
              <UIcon name="i-lucide-warehouse" class="size-4" aria-hidden="true" />
            </span>
          </div>
        </template>

        <div v-if="valuation.warehouses.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <caption class="sr-only">
              Detalle por almacén
            </caption>
            <thead class="border-b border-default text-muted">
              <tr>
                <th scope="col" class="py-2 pr-4 text-left font-medium">
                  Almacén
                </th>
                <th scope="col" class="py-2 text-right font-medium">
                  Valor de la mercancía
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="warehouse in valuation.warehouses" :key="warehouse.id">
                <th scope="row" class="py-2 pr-4 text-left font-medium text-highlighted">
                  {{ warehouse.name }}
                  <span class="block text-xs font-normal text-muted">{{ warehouse.code }}</span>
                </th>
                <td class="py-2 text-right tabular-nums">
                  <template v-if="warehouse.totals.length">
                    <div v-for="total in warehouse.totals" :key="total.currencyCode" class="whitespace-nowrap">
                      {{ purchaseMoney(total.amount, total.currencyCode) }}
                      <span v-if="total.currencyCode === 'MXN'" class="text-muted">MXN</span>
                    </div>
                  </template>
                  <span v-else class="text-muted">
                    Sin importe
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-muted">
          Sin almacenes registrados.
        </p>
      </UCard>
    </div>
  </section>
</template>
