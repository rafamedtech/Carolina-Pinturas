<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InventoryValuation } from '#shared/types/inventory'
import { purchaseMoney } from '~/utils/purchaseFormat'

const props = defineProps<{ valuation: InventoryValuation }>()
const warehouses = computed(() => [...props.valuation.warehouses].sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true })))
const columns: TableColumn<InventoryValuation['warehouses'][number]>[] = [
  { accessorKey: 'name', header: 'Almacén' },
  { id: 'value', header: 'Valor de la mercancía', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } }
]
</script>

<template>
  <section aria-label="Valor actual de la mercancía" class="min-w-0 space-y-6">
    <UPageGrid class="grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2" :class="{ 'xl:grid-cols-3': valuation.totals.length > 1 }">
      <DetailStatCard
        v-for="total in valuation.totals"
        :key="total.currencyCode"
        :title="`Total general · ${total.currencyCode}`"
        :value="purchaseMoney(total.amount, total.currencyCode)"
        value-color="primary"
        icon="i-lucide-package"
      />
      <DetailStatCard
        v-if="!valuation.totals.length"
        title="Total general"
        value="Sin importe"
        icon="i-lucide-package"
      />
      <DetailStatCard
        title="Almacenes"
        :value="valuation.warehouses.length"
        icon="i-lucide-warehouse"
      />
    </UPageGrid>

    <div class="min-w-0 space-y-3">
      <DetailSectionHeading title="Detalle por almacén" description="Valor de las existencias separado por moneda." />
      <DetailTable
        :data="warehouses"
        :columns="columns"
        aria-label="Valor de la mercancía por almacén"
        empty="Sin almacenes registrados"
      >
        <template #name-cell="{ row: { original } }">
          <p class="font-medium text-highlighted">
            {{ original.name }}
          </p>
          <p class="text-xs text-muted">
            {{ original.code }}
          </p>
        </template>
        <template #value-cell="{ row: { original } }">
          <div v-for="total in original.totals" :key="total.currencyCode" class="whitespace-nowrap text-primary">
            {{ purchaseMoney(total.amount, total.currencyCode) }}
            <span class="text-xs text-muted">{{ total.currencyCode }}</span>
          </div>
          <span v-if="!original.totals.length" class="text-muted">Sin importe</span>
        </template>
      </DetailTable>
    </div>
  </section>
</template>
