<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { TableColumn } from '@nuxt/ui'
import { inventoryTypes } from '#shared/schemas/inventory'
import type { ListLayoutConfig } from '~/types/list'
import type { OrderDateRange } from '~/types/orders'
import { tableQueryField, tableQueryText, tableQueryBoolean, tableQueryPage, tableQueryDate } from '~/utils/tableQuery'
import type { InventoryStock, InventoryWarehouse, InventorySettings, InventoryMovement, InventoryCount, InventoryPage, InventorySummary as InventorySummaryData } from '#shared/types/inventory'
import type { InventoryCommand } from '#shared/schemas/inventory'
import type { CsvColumn } from '~/utils/csv'
import { fetchAllPages } from '~/composables/useCsvExport'
import { formatDate, mexicoToday } from '~/utils/datetime'

const { user } = useAuth()
const canViewSummary = computed(() => ['admin', 'consulta'].includes(user.value?.role ?? ''))
const admin = computed(() => user.value?.role === 'admin')
const operational = computed(() => admin.value || user.value?.role === 'mostrador')
const stockTable = useTemplateRef('stockTable')
const reservationsTable = useTemplateRef('reservationsTable')
const movementsTable = useTemplateRef('movementsTable')
const defaultTab = computed(() => admin.value ? 'summary' : 'stocks')
const tab = shallowRef(defaultTab.value)
const search = shallowRef(''), warehouse = shallowRef(''), type = shallowRef(''), from = shallowRef(''), to = shallowRef(''), productId = shallowRef('')
const low = shallowRef(false), pageNumber = shallowRef(1)
const query = computed(() => ({ page: pageNumber.value, page_size: 25, search: search.value, warehouseId: warehouse.value || undefined, productId: productId.value || undefined, type: type.value || undefined, from: from.value || undefined, to: to.value || undefined, low: low.value ? 'true' : undefined }))
const { returnTo } = useTableQuery([
  tableQueryField('productId', productId, tableQueryText()),
  tableQueryField('tab', tab, {
    parse: value => tableQueryText(productId.value ? 'kardex' : defaultTab.value, [...(canViewSummary.value ? ['summary'] : []), 'stocks', 'kardex', 'reservations', 'movements', 'counts']).parse(value === 'valuation' ? 'summary' : value),
    serialize: value => value === defaultTab.value && !productId.value ? undefined : value
  }),
  tableQueryField('search', search, tableQueryText()),
  tableQueryField('warehouseId', warehouse, tableQueryText()),
  tableQueryField('type', type, tableQueryText()),
  tableQueryField('from', from, tableQueryDate),
  tableQueryField('to', to, tableQueryDate),
  tableQueryField('low', low, tableQueryBoolean),
  tableQueryField('page', pageNumber, tableQueryPage)
], { page: pageNumber, resetOn: [tab, search, warehouse, type, from, to, productId, low] })
const requestFetch = useRequestFetch()
const { data: warehouseData, refresh: refreshWarehouses, error: warehouseError } = useAsyncData('inventory-warehouses', async () => ({ results: await fetchAllPages<InventoryWarehouse>('/api/inventory/warehouses', {}, 100, requestFetch) }), { lazy: true, server: false })
const { data: settings, refresh: refreshSettings } = useFetch<InventorySettings>('/api/inventory/settings', { lazy: true, server: false })
type Row = InventoryStock | InventoryMovement | InventoryCount | { orderId: string, productId: string, quantity: string, order: { folio: number }, product: { code: string, name: string }, warehouse: { name: string } }
const resource = computed(() => tab.value === 'summary' ? 'stocks' : tab.value)
const endpoint = computed(() => `/api/inventory/${resource.value}`)
const { data: result, error: loadError, status, refresh } = useFetch<InventoryPage<Row>>(endpoint, { lazy: true, server: false, query, immediate: false, watch: false })
watch([endpoint, query], () => {
  if (tab.value !== 'summary') void refresh()
}, { immediate: true })
const { data: summary, status: summaryStatus, error: summaryError, refresh: refreshSummary } = useFetch<InventorySummaryData>('/api/inventory/summary', { lazy: true, server: false, immediate: false, watch: false })
watch(tab, (value) => {
  if (value === 'summary') void refreshSummary()
}, { immediate: true })
async function refreshCurrentTab() {
  if (tab.value === 'summary') await refreshSummary()
  else await refresh()
}
const stockRows = computed(() => (result.value?.results ?? []) as InventoryStock[])
const movementRows = computed(() => (result.value?.results ?? []) as InventoryMovement[])
const countRows = computed(() => (result.value?.results ?? []) as InventoryCount[])
const reservationRows = computed(() => (result.value?.results ?? []) as Array<Extract<Row, { orderId: string }>>)
const tabs = computed(() => [...(canViewSummary.value ? [{ label: 'Resumen', value: 'summary', icon: 'i-lucide-layout-dashboard' }] : []), { label: 'Existencias', value: 'stocks', icon: 'i-lucide-package' }, { label: 'Kardex', value: 'kardex', icon: 'i-lucide-list' }, { label: 'Reservas', value: 'reservations', icon: 'i-lucide-bookmark' }, ...((operational.value || user.value?.role === 'consulta') ? [{ label: 'Movimientos', value: 'movements', icon: 'i-lucide-arrow-left-right' }, { label: 'Conteos', value: 'counts', icon: 'i-lucide-clipboard-check' }] : [])])
const tabDescriptions: Record<string, string> = {
  summary: 'Valor de la mercancía, disponibilidad y pendientes de tu inventario en un solo lugar.',
  stocks: 'Existencias físicas, reservas y cantidades disponibles por producto y almacén.',
  kardex: 'Historial de entradas, salidas y existencias resultantes por almacén.',
  reservations: 'Mercancía apartada en pedidos activos.',
  movements: 'Entradas, salidas, traspasos y ajustes de inventario.',
  counts: 'Conteos físicos y conciliación de existencias por almacén.'
}
const activeView = computed(() => ({
  title: tabs.value.find(item => item.value === tab.value)?.label || 'Inventario',
  description: tabDescriptions[tab.value]
}))

const movementOpen = shallowRef(false), countOpen = shallowRef(false), countCreateOpen = shallowRef(false), minimumOpen = shallowRef(false), reverseOpen = shallowRef(false)
const source = shallowRef<InventoryMovement>(), selectedCount = shallowRef<InventoryCount>(), minimumStock = shallowRef<InventoryStock>(), reversal = shallowRef<InventoryMovement>()
const minimumValue = shallowRef('')
const countDraft = reactive({ warehouseId: '', date: mexicoToday(), reason: '' })
const { busy, error, run } = useInventoryAction(async (result, command) => {
  await Promise.all([refreshCurrentTab(), refreshSettings(), refreshWarehouses()])
  if (command.action.startsWith('count')) selectedCount.value = result as InventoryCount
})
async function save(command: InventoryCommand['command']) {
  if (await run(command)) {
    movementOpen.value = false
    countCreateOpen.value = false
    minimumOpen.value = false
    reverseOpen.value = false
    if (command.action === 'countCreate') countOpen.value = true
  }
}
function reverse(row: InventoryMovement) {
  reversal.value = row
  reverseOpen.value = true
}
function openMove(row?: InventoryMovement) {
  source.value = row
  movementOpen.value = true
}
function showKardex(row: InventoryStock) {
  productId.value = row.productId
  warehouse.value = row.warehouseId
  tab.value = 'kardex'
}
function setMinimum(row: InventoryStock) {
  minimumStock.value = row
  minimumValue.value = row.minimum
  minimumOpen.value = true
}
const columns = computed<CsvColumn[]>(() => tab.value === 'stocks' ? [{ key: 'code', label: 'Código' }, { key: 'name', label: 'Producto' }, { key: 'warehouse', label: 'Almacén' }, { key: 'quantity', label: 'Existencia' }, { key: 'reserved', label: 'Reservado' }, { key: 'available', label: 'Disponible' }, { key: 'minimum', label: 'Mínimo' }] : [{ key: 'folio', label: 'Folio' }, { key: 'date', label: 'Fecha', value: row => formatDate((row as { date: string }).date) }, { key: 'type', label: 'Tipo' }, { key: 'productCode', label: 'Código' }, { key: 'productName', label: 'Producto' }, { key: 'warehouseName', label: 'Almacén' }, { key: 'delta', label: 'Movimiento' }, { key: 'balanceAfter', label: 'Existencia resultante' }, { key: 'reason', label: 'Motivo' }])
async function exportRows() {
  const rows = await fetchAllPages<Row>(endpoint.value, query.value)
  return ['movements', 'kardex'].includes(tab.value) ? (rows as InventoryMovement[]).flatMap(m => m.lines.map(l => ({ ...l, folio: `INV-${m.folio}`, date: m.date, type: m.type, reason: m.reason }))) : rows
}
const warehouseFilter = computed({ get: () => warehouse.value || 'all', set: (value: string) => {
  warehouse.value = value === 'all' ? '' : value
} })
const typeFilter = computed({ get: () => type.value || 'all', set: (value: string) => {
  type.value = value === 'all' ? '' : value
} })
const filterValues = useListFilterBindings({ warehouse: warehouseFilter, type: typeFilter, low })
const dateRange = computed<OrderDateRange | null>({
  get: () => {
    try {
      return from.value || to.value ? { start: from.value ? parseDate(from.value) : undefined, end: to.value ? parseDate(to.value) : undefined } : null
    } catch {
      return null
    }
  },
  set: (value) => {
    from.value = value?.start?.toString() || ''
    to.value = value?.end?.toString() || ''
  }
})
const listConfig = computed<ListLayoutConfig>(() => ({
  id: 'inventory', title: 'Control de inventario', empty: 'Sin registros para estos filtros.', resetTabOnClear: false,
  breadcrumbs: [
    { label: 'Inventario', icon: 'i-lucide-warehouse', to: '/inventario' },
    { label: activeView.value.title }
  ],
  search: tab.value === 'summary' ? undefined : { placeholder: 'Buscar código o producto' }, tabs: tabs.value, defaultTab: defaultTab.value,
  dateFilter: ['movements', 'kardex', 'counts'].includes(tab.value) ? { subject: 'movimientos de inventario' } : undefined,
  filters: tab.value === 'summary'
    ? []
    : [
        { key: 'warehouse', label: 'Almacén', type: 'select' as const, defaultValue: 'all', items: [{ label: 'Todos los almacenes', value: 'all' }, ...(warehouseData.value?.results ?? []).map(w => ({ label: w.name, value: w.id }))] },
        ...(['movements', 'kardex'].includes(tab.value) ? [{ key: 'type', label: 'Movimiento', type: 'select' as const, defaultValue: 'all', items: [{ label: 'Todos', value: 'all' }, ...inventoryTypes.map(value => ({ label: value.replaceAll('_', ' '), value }))] }] : []),
        ...(tab.value === 'stocks' ? [{ key: 'low', label: 'Bajo mínimo', type: 'checkbox' as const, defaultValue: false }] : [])
      ],
  create: operational.value && (settings.value?.enabledAt || admin.value) && ['stocks', 'movements'].includes(tab.value)
    ? { label: settings.value?.enabledAt ? 'Nuevo movimiento' : 'Cargar saldo inicial' }
    : operational.value && tab.value === 'counts'
      ? { label: 'Nuevo conteo' }
      : undefined,
  pagination: tab.value !== 'summary' && result.value?.pagination ? { mode: 'server', label: 'registros', pageSize: 25 } : undefined
}))
function createInventoryRecord() {
  if (tab.value === 'counts') countCreateOpen.value = true
  else openMove()
}
function openSummaryView(view: 'stocks' | 'reservations' | 'counts' | 'movements', belowMinimum = false) {
  search.value = ''
  productId.value = ''
  warehouse.value = ''
  type.value = ''
  from.value = ''
  to.value = ''
  low.value = belowMinimum
  tab.value = view
}
function clearInventoryFilters() {
  productId.value = ''
  warehouse.value = ''
  type.value = ''
  low.value = false
}

const NuxtLink = resolveComponent('NuxtLink')
const reservationColumns: TableColumn<Extract<Row, { orderId: string }>>[] = [
  { id: 'order', header: 'Pedido', cell: ({ row }) => h(NuxtLink, { to: { path: `/ventas/${row.original.orderId}`, query: { returnTo: returnTo.value } }, class: 'text-primary underline' }, () => String(row.original.order.folio)) },
  { id: 'product', header: 'Producto', cell: ({ row }) => `${row.original.product.code} · ${row.original.product.name}` },
  { id: 'warehouse', header: 'Almacén', cell: ({ row }) => row.original.warehouse.name },
  { accessorKey: 'quantity', header: 'Reservado' }
]
</script>

<template>
  <ListLayout
    v-model:search="search"
    v-model:tab="tab"
    v-model:date-range="dateRange"
    v-model:filters="filterValues"
    v-model:page="pageNumber"
    :config="listConfig"
    :data="result?.results ?? []"
    :columns="[]"
    toolbar-below-tabs
    tabs-variant="link"
    tabs-full-width
    :loading="['idle', 'pending'].includes(tab === 'summary' ? summaryStatus : status)"
    :error="tab === 'summary' ? Boolean(summaryError) : Boolean(loadError || warehouseError)"
    :error-message="tab === 'summary' ? (summaryError?.data?.statusMessage || 'No se pudo cargar el resumen de inventario.') : loadError?.data?.statusMessage || (warehouseError ? 'No se pudieron cargar los almacenes.' : undefined)"
    :total-results="result?.pagination?.totalResults"
    @refresh="refreshCurrentTab()"
    @create="createInventoryRecord"
    @clear="clearInventoryFilters"
  >
    <template #toolbar-actions>
      <ListColumnPicker v-if="tab === 'stocks'" :columns="stockTable?.getColumns() ?? []" />
      <ListColumnPicker v-else-if="tab === 'reservations'" :columns="reservationsTable?.getColumns() ?? []" />
      <ListColumnPicker v-else-if="['movements', 'kardex'].includes(tab)" :columns="movementsTable?.getColumns() ?? []" />
    </template>
    <template #actions>
      <AppCsvExportButton
        v-if="['stocks', 'movements', 'kardex'].includes(tab)"
        :key="tab"
        :filename="`inventario-${tab}`"
        :columns="columns"
        :fetch-all="exportRows"
      />
    </template>
    <template #before>
      <p class="text-base leading-relaxed text-toned">
        {{ activeView.description }}
      </p>
      <UAlert v-if="error" :title="error" color="error" />
      <div v-if="productId && tab !== 'summary'" class="flex items-center gap-2 text-sm">
        <span>Kardex de producto seleccionado</span><UButton
          label="Quitar filtro de producto"
          size="sm"
          variant="ghost"
          @click="productId = ''"
        />
      </div>
    </template>
    <template #content>
      <InventorySummary v-if="tab === 'summary' && summary" :summary="summary" @view="openSummaryView" />
      <InventoryStockTable
        v-else-if="tab === 'stocks'"
        ref="stockTable"
        :rows="stockRows"
        :admin="admin"
        @minimum="setMinimum"
        @kardex="showKardex"
      />
      <InventoryMovementsTable
        v-else-if="['movements', 'kardex'].includes(tab)"
        ref="movementsTable"
        :rows="movementRows"
        :admin="admin"
        :operational="operational"
        :kardex="tab === 'kardex'"
        @return="openMove"
        @reverse="reverse"
      />
      <div v-else-if="tab === 'counts'" class="space-y-3">
        <UPageCard v-for="row in countRows" :key="row.id" variant="subtle">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="font-semibold">
                {{ row.warehouse.name }} · {{ formatDate(row.date) }}
              </p><p class="text-sm text-muted">
                {{ row.reason }} · {{ row.lines.length }} productos
              </p>
            </div><div class="flex items-center gap-3">
              <UBadge color="neutral">
                {{ row.status }}
              </UBadge><UButton label="Abrir conteo" variant="outline" @click="selectedCount = row; countOpen = true" />
            </div>
          </div>
        </UPageCard>
        <UEmpty
          v-if="!countRows.length"
          icon="i-lucide-clipboard-check"
          title="Sin conteos registrados"
          description="Registra un conteo físico para conciliar las existencias del almacén."
          variant="naked"
        />
      </div>
      <div v-else-if="tab === 'reservations'">
        <div class="space-y-3 md:hidden">
          <ListRecordCard
            v-for="row in reservationRows"
            :key="`${row.orderId}-${row.productId}-${row.warehouse.name}`"
            :title="`Pedido ${row.order.folio}`"
            :title-to="{ path: `/ventas/${row.orderId}`, query: { returnTo } }"
            :fields="[
              { label: 'Producto', value: `${row.product.code} · ${row.product.name}`, fullWidth: true },
              { label: 'Almacén', value: row.warehouse.name, fullWidth: true }
            ]"
            summary-label="Reservado"
            :summary-value="row.quantity"
            summary-color="primary"
          />
          <UEmpty
            v-if="!reservationRows.length"
            icon="i-lucide-bookmark"
            title="Sin reservas activas"
            variant="naked"
          />
        </div>
        <DetailTable
          ref="reservationsTable"
          :data="reservationRows"
          :columns="reservationColumns"
          empty="Sin reservas activas."
          class="hidden md:block"
        />
      </div>
    </template>
    <template #overlays>
      <UModal
        v-model:open="movementOpen"
        :title="source ? 'Registrar devolución física' : 'Nuevo movimiento'"
        scrollable
        :ui="{ content: 'max-w-3xl' }"
      >
        <template #body>
          <UAlert
            v-if="error"
            :title="error"
            color="error"
            class="mb-4"
          /><InventoryMovementForm
            :key="source?.id ?? 'new'"
            :source="source"
            :warehouses="warehouseData?.results ?? []"
            :activated="Boolean(settings?.enabledAt)"
            :admin="admin"
            :busy="busy"
            @submit="save"
          />
        </template>
      </UModal>
      <UModal
        v-model:open="countOpen"
        title="Conteo físico"
        scrollable
        :ui="{ content: 'max-w-4xl' }"
      >
        <template #body>
          <UAlert
            v-if="error"
            :title="error"
            color="error"
            class="mb-4"
          /><InventoryCountForm
            v-if="selectedCount"
            :count="selectedCount"
            :activated="Boolean(settings?.enabledAt)"
            :admin="admin"
            :busy="busy"
            @submit="save"
          />
        </template>
      </UModal>
      <UModal v-model:open="countCreateOpen" title="Nuevo conteo físico">
        <template #body>
          <UAlert
            v-if="error"
            :title="error"
            color="error"
            class="mb-4"
          /><form class="space-y-4" @submit.prevent="save({ action: 'countCreate', ...countDraft })">
            <UFormField label="Almacén" required>
              <USelect
                v-model="countDraft.warehouseId"
                :items="warehouseData?.results.filter(w => w.active).map(w => ({ label: w.name, value: w.id })) ?? []"
                placeholder="Selecciona un almacén"
                class="w-full"
              />
            </UFormField><UFormField label="Fecha">
              <PurchasesPurchaseDate v-model="countDraft.date" />
            </UFormField><UFormField label="Motivo" required>
              <UTextarea
                v-model="countDraft.reason"
                required
                minlength="3"
                class="w-full"
              />
            </UFormField><UButton
              type="submit"
              label="Iniciar conteo"
              :loading="busy"
              :disabled="!countDraft.warehouseId"
            />
          </form>
        </template>
      </UModal>
      <UModal v-model:open="minimumOpen" title="Existencia mínima">
        <template #body>
          <UAlert
            v-if="error"
            :title="error"
            color="error"
            class="mb-4"
          /><form v-if="minimumStock" class="space-y-4" @submit.prevent="save({ action: 'minimum', warehouseId: minimumStock.warehouseId, productId: minimumStock.productId, version: minimumStock.version, minimum: minimumValue })">
            <p>{{ minimumStock.name }} · {{ minimumStock.warehouse }}</p><UFormField label="Mínimo">
              <UInput v-model="minimumValue" inputmode="decimal" />
            </UFormField><UButton type="submit" label="Guardar mínimo" :loading="busy" />
          </form>
        </template>
      </UModal>
      <UModal v-model:open="reverseOpen" title="Revertir movimiento">
        <template #body>
          <UAlert
            v-if="error"
            :title="error"
            color="error"
            class="mb-4"
          /><form v-if="reversal" class="space-y-4" @submit.prevent="save({ action: 'reverse', movementId: reversal.id, date: mexicoToday(), reason: countDraft.reason })">
            <p>Se registrará el movimiento inverso de INV-{{ reversal.folio }}. El documento original conservará su historial.</p><UFormField label="Motivo" required>
              <UTextarea
                v-model="countDraft.reason"
                required
                minlength="3"
                class="w-full"
              />
            </UFormField><UButton
              type="submit"
              label="Confirmar reversión"
              color="error"
              :loading="busy"
            />
          </form>
        </template>
      </UModal>
    </template>
  </ListLayout>
</template>
