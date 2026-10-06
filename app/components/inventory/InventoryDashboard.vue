<script setup lang="ts">
import type { InventoryStock, InventoryWarehouse, InventorySettings, InventoryMovement, InventoryCount, InventoryProduct, InventoryPage } from '#shared/types/inventory'
import type { InventoryCommand } from '#shared/schemas/inventory'
import type { CsvColumn } from '~/utils/csv'
import { fetchAllPages } from '~/composables/useCsvExport'
import { formatDate, formatDateTime, mexicoToday } from '~/utils/datetime'

const { user } = useAuth()
const admin = computed(() => user.value?.role === 'admin')
const operational = computed(() => admin.value || user.value?.role === 'mostrador')
const route = useRoute()
const tab = shallowRef(route.query.productId ? 'kardex' : 'stocks')
const search = shallowRef(''), warehouse = shallowRef(String(route.query.warehouseId ?? '')), type = shallowRef(''), from = shallowRef(''), to = shallowRef(''), productId = shallowRef(String(route.query.productId ?? ''))
const low = shallowRef(false), pageNumber = shallowRef(1)
const query = computed(() => ({ page: pageNumber.value, page_size: 25, search: search.value, warehouseId: warehouse.value || undefined, productId: productId.value || undefined, type: type.value || undefined, from: from.value || undefined, to: to.value || undefined, low: low.value ? 'true' : undefined }))
watch([tab, search, warehouse, type, from, to, productId, low], () => {
  pageNumber.value = 1
})
const requestFetch = useRequestFetch()
const { data: warehouseData, refresh: refreshWarehouses, error: warehouseError } = await useAsyncData('inventory-warehouses', async () => ({ results: await fetchAllPages<InventoryWarehouse>('/api/inventory/warehouses', {}, 100, requestFetch) }))
const { data: settings, refresh: refreshSettings } = await useFetch<InventorySettings>('/api/inventory/settings')
type Row = InventoryStock | InventoryMovement | InventoryCount | InventoryProduct | { orderId: string, productId: string, quantity: string, order: { folio: number }, product: { code: string, name: string }, warehouse: { name: string } }
const resource = computed(() => tab.value === 'warehouses' ? 'products' : tab.value)
const endpoint = computed(() => `/api/inventory/${resource.value}`)
const { data: result, error: loadError, status, refresh } = await useFetch<InventoryPage<Row>>(endpoint, { query })
const stockRows = computed(() => (result.value?.results ?? []) as InventoryStock[])
const movementRows = computed(() => (result.value?.results ?? []) as InventoryMovement[])
const countRows = computed(() => (result.value?.results ?? []) as InventoryCount[])
const productRows = computed(() => (result.value?.results ?? []) as InventoryProduct[])
const reservationRows = computed(() => (result.value?.results ?? []) as Array<Extract<Row, { orderId: string }>>)
const tabs = computed(() => [{ label: 'Existencias', value: 'stocks', icon: 'i-lucide-package' }, { label: 'Kardex', value: 'kardex', icon: 'i-lucide-list' }, { label: 'Reservas', value: 'reservations', icon: 'i-lucide-bookmark' }, ...(operational.value ? [{ label: 'Movimientos', value: 'movements', icon: 'i-lucide-arrow-left-right' }, { label: 'Conteos', value: 'counts', icon: 'i-lucide-clipboard-check' }] : []), ...(admin.value ? [{ label: 'Almacenes y configuración', value: 'warehouses', icon: 'i-lucide-warehouse' }] : [])])
const warehouseOpen = shallowRef(false), movementOpen = shallowRef(false), countOpen = shallowRef(false), countCreateOpen = shallowRef(false), minimumOpen = shallowRef(false), reverseOpen = shallowRef(false), activateOpen = shallowRef(false)
const editingWarehouse = shallowRef<InventoryWarehouse>(), source = shallowRef<InventoryMovement>(), selectedCount = shallowRef<InventoryCount>(), minimumStock = shallowRef<InventoryStock>(), reversal = shallowRef<InventoryMovement>()
const minimumValue = shallowRef('')
const countDraft = reactive({ warehouseId: '', date: mexicoToday(), reason: '' })
const { busy, error, run } = useInventoryAction(async (result, command) => {
  await Promise.all([refresh(), refreshSettings(), refreshWarehouses()])
  if (command.action.startsWith('count')) selectedCount.value = result as InventoryCount
})
async function save(command: InventoryCommand['command']) {
  if (await run(command)) {
    warehouseOpen.value = false
    movementOpen.value = false
    countCreateOpen.value = false
    minimumOpen.value = false
    reverseOpen.value = false
    activateOpen.value = false
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
function openWarehouse(row?: InventoryWarehouse) {
  editingWarehouse.value = row
  warehouseOpen.value = true
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
</script>

<template>
  <UDashboardPanel id="inventory">
    <template #header>
      <UDashboardNavbar title="Inventario">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template><template #right>
          <UButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="status === 'pending'"
            @click="refresh()"
          /><AppCsvExportButton
            v-if="['stocks', 'movements', 'kardex'].includes(tab)"
            :key="tab"
            :filename="`inventario-${tab}`"
            :columns="columns"
            :fetch-all="exportRows"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-default pb-5">
          <div>
            <p class="text-xs font-semibold tracking-widest text-primary uppercase">
              Control de almacenes
            </p><h1 class="mt-1 text-2xl font-semibold text-highlighted">
              Cada unidad, en su lugar
            </h1><p class="mt-1 text-sm text-muted">
              Existencias físicas, reservas y movimientos internos.
            </p>
          </div><UBadge :color="settings?.enabledAt ? 'success' : 'warning'" variant="subtle" size="lg">
            {{ settings?.enabledAt ? `Activo desde ${formatDateTime(settings.enabledAt)}` : 'Preparando inventario inicial' }}
          </UBadge>
        </div>
        <UAlert
          v-if="!settings?.enabledAt"
          title="Carga las existencias reales antes de activar"
          description="Crea almacenes, registra el saldo inicial o aplica un conteo. Al activar, los pedidos nuevos reservarán y descontarán inventario; los documentos históricos conservarán su comportamiento."
          color="warning"
        >
          <template #actions>
            <UButton
              v-if="admin"
              label="Activar inventario"
              color="neutral"
              variant="solid"
              class="bg-black text-white hover:bg-zinc-800 dark:bg-black dark:text-white dark:hover:bg-zinc-800"
              @click="activateOpen = true"
            />
          </template>
        </UAlert>
        <UAlert v-if="error || loadError || warehouseError" :title="error || loadError?.data?.statusMessage || (warehouseError ? 'No se pudieron cargar los almacenes.' : 'No se pudo cargar inventario.')" color="error" />
        <UTabs
          v-model="tab"
          :items="tabs"
          :content="false"
          class="w-full"
        />
        <InventoryFilters
          v-model:search="search"
          v-model:warehouse="warehouse"
          v-model:type="type"
          v-model:from="from"
          v-model:to="to"
          v-model:low="low"
          :warehouses="warehouseData?.results ?? []"
          :show-dates="['movements', 'kardex', 'counts'].includes(tab)"
          :show-type="['movements', 'kardex'].includes(tab)"
          :show-low="tab === 'stocks'"
        />
        <div v-if="productId" class="flex items-center gap-2 text-sm">
          <span>Kardex de producto seleccionado</span><UButton
            label="Quitar filtro de producto"
            size="sm"
            variant="ghost"
            @click="productId = ''"
          />
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton
            v-if="operational && (settings?.enabledAt || admin) && ['stocks', 'movements'].includes(tab)"
            :label="settings?.enabledAt ? 'Nuevo movimiento' : 'Cargar saldo inicial'"
            icon="i-lucide-plus"
            @click="openMove()"
          /><UButton
            v-if="operational && tab === 'counts'"
            label="Nuevo conteo"
            icon="i-lucide-clipboard-plus"
            @click="countCreateOpen = true"
          /><UButton
            v-if="admin && tab === 'warehouses'"
            label="Nuevo almacén"
            icon="i-lucide-plus"
            @click="openWarehouse()"
          />
        </div>
        <div
          v-if="status === 'pending'"
          class="space-y-3"
          role="status"
          aria-label="Cargando inventario"
        >
          <USkeleton v-for="i in 4" :key="i" class="h-16 w-full" />
        </div>
        <template v-else>
          <InventoryStockTable
            v-if="tab === 'stocks'"
            :rows="stockRows"
            :admin="admin"
            @minimum="setMinimum"
            @kardex="showKardex"
          />
          <InventoryMovementsTable
            v-else-if="['movements', 'kardex'].includes(tab)"
            :rows="movementRows"
            :admin="admin"
            :operational="operational"
            :kardex="tab === 'kardex'"
            @return="openMove"
            @reverse="reverse"
          />
          <div v-else-if="tab === 'counts'" class="space-y-3">
            <UCard v-for="row in countRows" :key="row.id">
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
            </UCard><p v-if="!countRows.length" class="p-8 text-center text-muted">
              Sin conteos registrados.
            </p>
          </div>
          <div v-else-if="tab === 'reservations'" class="overflow-auto rounded-lg border border-default">
            <table class="w-full text-sm">
              <thead class="bg-elevated text-left">
                <tr>
                  <th class="p-3">
                    Pedido
                  </th><th class="p-3">
                    Producto
                  </th><th class="p-3">
                    Almacén
                  </th><th class="p-3 text-right">
                    Reservado
                  </th>
                </tr>
              </thead><tbody class="divide-y divide-default">
                <tr v-for="row in reservationRows" :key="`${row.orderId}-${row.productId}`">
                  <td class="p-3">
                    <NuxtLink :to="`/ventas/${row.orderId}`" class="text-primary underline">{{ row.order.folio }}</NuxtLink>
                  </td><td class="p-3">
                    {{ row.product.code }} · {{ row.product.name }}
                  </td><td class="p-3">
                    {{ row.warehouse.name }}
                  </td><td class="p-3 text-right font-mono">
                    {{ row.quantity }}
                  </td>
                </tr><tr v-if="!reservationRows.length">
                  <td colspan="4" class="p-8 text-center text-muted">
                    Sin reservas activas.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else-if="tab === 'warehouses'" class="space-y-5">
            <div class="grid gap-3 md:grid-cols-2">
              <UCard v-for="w in warehouseData?.results" :key="w.id">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm text-muted">
                      {{ w.code }}
                    </p><h2 class="font-semibold">
                      {{ w.name }}
                    </h2><p class="mt-1 text-sm text-muted">
                      {{ w.address }}
                    </p><UBadge class="mt-2" :color="w.active ? 'success' : 'neutral'">
                      {{ w.active ? 'Activo' : 'Inactivo' }}
                    </UBadge>
                  </div><UButton
                    label="Editar"
                    variant="outline"
                    size="sm"
                    @click="openWarehouse(w)"
                  />
                </div>
              </UCard>
            </div><UCard>
              <template #header>
                <h2 class="font-semibold">
                  Control interno por producto
                </h2><p class="text-sm text-muted">
                  Esta configuración pertenece al inventario interno y es independiente del catálogo fiscal.
                </p>
              </template><ul class="divide-y divide-default">
                <li v-for="p in productRows" :key="p.id" class="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p class="font-medium">
                      {{ p.name }}
                    </p><p class="text-sm text-muted">
                      {{ p.code }} · {{ p.unit }}
                    </p>
                  </div><USwitch
                    :model-value="p.enabled"
                    :aria-label="`Control interno de ${p.name}`"
                    :disabled="busy"
                    @update:model-value="enabled => save({ action: 'tracking', productId: p.id, version: p.version, enabled })"
                  />
                </li>
              </ul>
            </UCard>
          </div>
        </template>
        <div v-if="result?.pagination" class="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>{{ result.pagination.totalResults }} registros</span><UPagination v-model:page="pageNumber" :total="result.pagination.totalResults" :items-per-page="25" />
        </div>
      </div>
      <UModal v-model:open="warehouseOpen" :title="editingWarehouse ? 'Editar almacén' : 'Nuevo almacén'">
        <template #body>
          <UAlert
            v-if="error"
            :title="error"
            color="error"
            class="mb-4"
          /><InventoryWarehouseForm
            :key="editingWarehouse?.id ?? 'new'"
            :warehouse="editingWarehouse"
            :busy="busy"
            @submit="save"
          />
        </template>
      </UModal>
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
      <UModal v-model:open="activateOpen" title="Activar inventario interno">
        <template #body>
          <div class="space-y-4">
            <UAlert v-if="error" :title="error" color="error" /><p>Confirma que los almacenes y sus existencias iniciales corresponden al conteo real. Desde este momento, los pedidos nuevos tendrán control de inventario. Los pedidos anteriores quedarán como históricos.</p><UButton
              v-if="settings"
              label="Confirmar activación"
              :loading="busy"
              @click="save({ action: 'activate', version: settings.version })"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
