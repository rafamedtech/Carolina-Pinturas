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
function openWarehouse(row: InventoryStock) {
  selectedWarehouseId.value = row.warehouseId
  modalOpen.value = true
}
function showKardex(row: InventoryStock) {
  return navigateTo({ path: '/inventario', query: { productId: row.productId, warehouseId: row.warehouseId } })
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold text-primary">
        Existencias del producto
      </h2>
    </template>

    <UAlert v-if="error" title="No se pudo cargar el inventario interno." color="error" />
    <div
      v-else-if="['idle', 'pending'].includes(status)"
      class="space-y-4"
      role="status"
      aria-busy="true"
    >
      <USkeleton class="h-32 w-full rounded-lg" />
      <USkeleton class="h-20 w-full rounded-lg" />
      <span class="sr-only">Cargando inventario…</span>
    </div>
    <div v-else-if="stocks?.length" class="space-y-5">
      <div class="grid grid-cols-2 items-center gap-4 rounded-lg bg-primary/5 p-4 ring-1 ring-inset ring-primary/15">
        <div class="min-w-0">
          <p class="text-sm font-medium text-highlighted">
            Existencia total
          </p>
          <p class="mt-1 break-words text-3xl font-semibold text-primary tabular-nums">
            {{ totals.quantity }} <span class="text-xs font-normal text-muted">{{ totals.unit }}</span>
          </p>
          <p class="mt-1 text-xs text-muted">
            Suma de todos los almacenes
          </p>
        </div>
        <dl class="grid min-w-0 gap-3 border-l border-primary/15 pl-4 text-sm">
          <div class="min-w-0">
            <dt class="text-xs text-muted">
              Reservado
            </dt>
            <dd class="mt-1 break-words font-medium tabular-nums">
              {{ totals.reserved }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-xs text-muted">
              Disponible
            </dt>
            <dd class="mt-1 break-words font-semibold text-primary tabular-nums">
              {{ totals.available }}
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <p class="mb-2 text-xs font-medium text-muted">
          Detalle por almacén
        </p>
        <div class="grid grid-cols-2 gap-2">
          <UButton
            v-for="row in stocks"
            :key="row.warehouseId"
            :label="row.warehouse"
            icon="i-lucide-warehouse"
            :color="row.low ? 'warning' : 'neutral'"
            variant="outline"
            class="min-w-0 w-full"
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
  </UCard>

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
