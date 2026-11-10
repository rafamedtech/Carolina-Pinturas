<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { InventoryValuation } from '#shared/types/inventory'
import { purchaseMoney } from '~/utils/purchaseFormat'

const props = defineProps<{ valuation: InventoryValuation }>()
type Warehouse = InventoryValuation['warehouses'][number]
const warehouses = computed(() => [...props.valuation.warehouses].sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true })))
const columns: TableColumn<Warehouse>[] = [
  { accessorKey: 'name', header: 'Almacén' },
  { id: 'value', header: 'Valor registrado', meta: { class: { th: 'text-right', td: 'text-right tabular-nums' } } },
  { accessorKey: 'productsWithoutCost', header: 'Costos pendientes', meta: { class: { th: 'text-right', td: 'text-right' } } }
]
function warehouseFields(warehouse: Warehouse) {
  return [
    ...(warehouse.totals.length
      ? warehouse.totals.map(total => ({ label: `Valor · ${total.currencyCode}`, value: purchaseMoney(total.amount, total.currencyCode) }))
      : [{ label: 'Valor registrado', value: warehouse.productsWithoutCost ? 'Pendiente de costo' : 'Sin importe' }]),
    { label: 'Costos pendientes', value: warehouse.productsWithoutCost }
  ]
}
</script>

<template>
  <section aria-labelledby="inventory-valuation-title" class="min-w-0 space-y-4">
    <DetailSectionHeading
      title="Valor de la mercancía"
      title-id="inventory-valuation-title"
      description="Existencias físicas, incluidas las reservas, al último costo registrado. Cada moneda se presenta por separado."
    />

    <UPageGrid class="gap-3 sm:grid-cols-2" :class="valuation.totals.length > 1 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'">
      <DetailStatCard
        v-for="total in valuation.totals"
        :key="total.currencyCode"
        :title="`Valor registrado · ${total.currencyCode}`"
        :value="purchaseMoney(total.amount, total.currencyCode)"
        value-color="primary"
        icon="i-lucide-banknote"
      >
        <p class="text-xs text-muted">
          Total de todos los almacenes.
        </p>
      </DetailStatCard>
      <DetailStatCard
        v-if="!valuation.totals.length"
        title="Valor registrado"
        value="Sin importe"
        icon="i-lucide-banknote"
      >
        <p class="text-xs text-muted">
          Aún no hay existencias con costo y moneda registrados.
        </p>
      </DetailStatCard>
      <DetailStatCard
        title="Productos sin costo"
        :value="valuation.productsWithoutCost"
        icon="i-lucide-receipt-text"
      >
        <p class="text-xs text-muted">
          Productos con existencias que requieren costo o moneda.
        </p>
      </DetailStatCard>
    </UPageGrid>

    <UAlert
      v-if="valuation.productsWithoutCost"
      icon="i-lucide-circle-alert"
      color="warning"
      variant="subtle"
      title="El valor registrado es parcial"
      description="Las existencias sin costo o moneda quedan fuera de los importes. Un mismo producto puede tener costos pendientes en varios almacenes."
    />

    <DetailCard class="min-w-0" :ui="{ container: 'min-w-0' }">
      <DetailSectionHeading title="Distribución por almacén" description="Importes registrados y productos pendientes de valorar en cada ubicación." />
      <div class="space-y-3 md:hidden">
        <ListRecordCard
          v-for="warehouse in warehouses"
          :key="warehouse.id"
          :title="warehouse.name"
          :eyebrow="`Almacén ${warehouse.code}`"
          :fields="warehouseFields(warehouse)"
        >
          <template v-if="warehouse.productsWithoutCost" #trailing>
            <UBadge color="warning" variant="subtle">
              Por completar
            </UBadge>
          </template>
        </ListRecordCard>
        <UEmpty
          v-if="!warehouses.length"
          title="Sin almacenes registrados"
          icon="i-lucide-warehouse"
          variant="naked"
        />
      </div>
      <DetailTable
        :data="warehouses"
        :columns="columns"
        aria-label="Valor de la mercancía por almacén"
        empty="Sin almacenes registrados"
        class="hidden md:block"
      >
        <template #name-cell="{ row: { original } }">
          <p class="font-medium text-highlighted">
            {{ original.name }}
          </p>
          <p class="text-xs text-muted">
            Almacén {{ original.code }}
          </p>
        </template>
        <template #value-cell="{ row: { original } }">
          <div v-for="total in original.totals" :key="total.currencyCode" class="whitespace-nowrap font-medium text-highlighted">
            {{ purchaseMoney(total.amount, total.currencyCode) }}
            <span class="ml-1 text-xs text-muted">{{ total.currencyCode }}</span>
          </div>
          <span v-if="!original.totals.length" class="text-muted">{{ original.productsWithoutCost ? 'Pendiente de costo' : 'Sin importe' }}</span>
        </template>
        <template #productsWithoutCost-cell="{ row: { original } }">
          <UBadge v-if="original.productsWithoutCost" color="warning" variant="subtle">
            {{ original.productsWithoutCost }} sin costo
          </UBadge>
          <span v-else class="text-muted">0</span>
        </template>
      </DetailTable>
    </DetailCard>
  </section>
</template>
