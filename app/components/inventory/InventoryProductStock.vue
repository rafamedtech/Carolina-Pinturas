<script setup lang="ts">
import Decimal from 'decimal.js'
import type { InventoryStock, InventoryPage } from '#shared/types/inventory'

const props = defineProps<{ productId: string }>()
const requestFetch = useRequestFetch()
const { data: stocks, error, status } = useAsyncData(
  () => `product-warehouse-stocks-${props.productId}`,
  async () => {
    const productId = props.productId
    const rows: InventoryStock[] = []
    let page = 1
    let totalPages = 1
    do {
      const result = await requestFetch<InventoryPage<InventoryStock>>('/api/inventory/stocks', {
        query: { productId, page, page_size: 100 }
      })
      rows.push(...result.results)
      totalPages = result.pagination.totalPages
      page++
    } while (page <= totalPages)
    return rows
  }, { lazy: true, server: false }
)
const loading = computed(() => ['idle', 'pending'].includes(status.value))
const selectedWarehouseId = shallowRef<string | null>(null)
const modalOpen = shallowRef(false)
const selectedStock = computed(() => stocks.value?.find(row => row.warehouseId === selectedWarehouseId.value))
const totals = computed(() => {
  const rows = stocks.value ?? []
  const sum = (field: 'quantity' | 'reserved' | 'available') => rows.reduce((total, row) => total.plus(row[field]), new Decimal(0)).toString()
  return { quantity: sum('quantity'), reserved: sum('reserved'), available: sum('available'), unit: rows[0]?.unit || 'Unidad' }
})
const warehouseFields = computed(() => {
  const row = selectedStock.value
  if (!row) return []
  return [
    { label: 'Existencia física', value: row.quantity },
    { label: 'Reservado', value: row.reserved },
    { label: 'Mínimo', value: row.minimum },
    { label: 'Costo unitario', value: row.unitCost ? `${row.unitCost} ${row.costCurrency || ''}` : 'Sin costo' }
  ]
})
function warehouseColor(row: InventoryStock) {
  const quantity = new Decimal(row.quantity)
  if (quantity.lte(0)) return 'error'
  return quantity.lte(row.minimum) ? 'warning' : 'primary'
}

function openWarehouse(row: InventoryStock) {
  selectedWarehouseId.value = row.warehouseId
  modalOpen.value = true
}
function showKardex(row: InventoryStock) {
  return navigateTo({ path: '/inventario', query: { productId: row.productId, warehouseId: row.warehouseId } })
}
</script>

<template>
  <UPageCard
    title="Existencias del producto"
    description="Suma de todos los almacenes."
    variant="naked"
    :ui="{ title: 'text-lg font-semibold' }"
  >
    <UAlert v-if="error" title="No se pudo cargar el inventario interno." color="error" />
    <div v-else-if="loading || stocks?.length" class="space-y-5" :aria-busy="loading">
      <UPageGrid class="gap-2 sm:grid-cols-3 sm:gap-px">
        <UPageCard
          v-for="stat in [
            { title: 'Existencia total', value: totals.quantity, icon: 'i-lucide-package' },
            { title: 'Reservado', value: totals.reserved, icon: 'i-lucide-bookmark' },
            { title: 'Disponible', value: totals.available, icon: 'i-lucide-package-check' }
          ]"
          :key="stat.title"
          :title="stat.title"
          :icon="stat.icon"
          variant="subtle"
          :ui="{ container: 'gap-y-2 p-4 sm:p-4', title: 'text-xs font-normal text-muted uppercase' }"
          class="sm:rounded-none sm:first:rounded-l-lg sm:last:rounded-r-lg"
        >
          <USkeleton v-if="loading" class="h-8 w-24" />
          <template v-else>
            <span class="text-2xl font-semibold text-highlighted tabular-nums">{{ stat.value }}</span>
            <span class="ml-1 text-xs text-muted">{{ totals.unit }}</span>
          </template>
        </UPageCard>
      </UPageGrid>

      <div>
        <p class="mb-2 text-xs font-medium text-muted">
          Detalle por almacén
        </p>
        <div v-if="loading" class="flex flex-wrap gap-2" aria-label="Cargando almacenes">
          <USkeleton v-for="index in 3" :key="index" class="h-8 w-32" />
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <UButton
            v-for="row in stocks"
            :key="row.warehouseId"
            :label="`${row.warehouse} (${row.quantity})`"
            icon="i-lucide-warehouse"
            :color="warehouseColor(row)"
            variant="subtle"
            class="min-w-0 max-w-full"
            :ui="{ label: 'whitespace-normal text-left break-words' }"
            aria-haspopup="dialog"
            @click="openWarehouse(row)"
          />
        </div>
      </div>
    </div>
    <p v-else class="text-sm text-muted">
      Sin existencias registradas. Crea un almacén y registra el conteo inicial.
    </p>
  </UPageCard>

  <UModal v-model:open="modalOpen" :title="selectedStock?.warehouse || 'Detalle del almacén'" :description="selectedStock ? `${selectedStock.code} · ${selectedStock.name}` : undefined">
    <template #body>
      <div v-if="selectedStock" class="space-y-5">
        <UBadge v-if="selectedStock.low" color="warning" variant="subtle">
          Bajo mínimo
        </UBadge>
        <div class="rounded-lg bg-elevated/50 p-4">
          <p class="text-xs text-muted">
            Disponible
          </p>
          <p class="mt-1 break-words text-3xl font-semibold tabular-nums" :class="selectedStock.low ? 'text-warning' : 'text-primary'">
            {{ selectedStock.available }} <span class="text-sm font-normal text-muted">{{ selectedStock.unit || 'Unidad' }}</span>
          </p>
        </div>
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <div v-for="field in warehouseFields" :key="field.label" class="min-w-0">
            <dt class="text-xs text-muted">
              {{ field.label }}
            </dt>
            <dd class="mt-1 break-words font-medium tabular-nums">
              {{ field.value }}
            </dd>
          </div>
        </dl>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          label="Cerrar"
          color="neutral"
          variant="outline"
          @click="modalOpen = false"
        />
        <UButton
          v-if="selectedStock"
          label="Ver Kardex"
          icon="i-lucide-history"
          @click="showKardex(selectedStock)"
        />
      </div>
    </template>
  </UModal>
</template>
