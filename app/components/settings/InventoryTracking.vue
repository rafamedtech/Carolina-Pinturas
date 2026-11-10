<script setup lang="ts">
import type { InventoryPage, InventoryProduct } from '#shared/types/inventory'
import type { InventoryCommand } from '#shared/schemas/inventory'
import { tableQueryField, tableQueryPage, tableQueryText } from '~/utils/tableQuery'

const search = shallowRef('')
const tracking = shallowRef('all')
const productId = shallowRef('')
const page = shallowRef(1)
useTableQuery([
  tableQueryField('search', search, tableQueryText()),
  tableQueryField('tracking', tracking, tableQueryText('all', ['all', 'enabled', 'disabled'])),
  tableQueryField('productId', productId, tableQueryText()),
  tableQueryField('page', page, tableQueryPage)
], { page, resetOn: [search, tracking, productId] })

const query = computed(() => ({ page: page.value, page_size: 25, search: search.value, productId: productId.value || undefined, tracking: tracking.value === 'all' ? undefined : tracking.value }))
const { data, status, error: loadError, refresh } = useFetch<InventoryPage<InventoryProduct>>('/api/inventory/products', { lazy: true, server: false, query })
const { busy, error, run } = useInventoryAction(() => refresh())
const hasFilters = computed(() => Boolean(search.value.trim() || productId.value || tracking.value !== 'all'))
const canUpdateFiltered = computed(() => hasFilters.value && status.value === 'success' && !loadError.value && Boolean(data.value?.pagination.totalResults) && !busy.value)

async function save(command: InventoryCommand['command']) {
  await run(command)
}

async function setFilteredTracking(enabled: boolean) {
  if (!canUpdateFiltered.value) return
  await run({ action: 'trackingFiltered', enabled, filters: {
    search: search.value.trim(),
    productId: productId.value || undefined,
    tracking: tracking.value === 'enabled' || tracking.value === 'disabled' ? tracking.value : undefined
  } })
}

const filteredActions = [
  { label: 'Activar resultados filtrados', icon: 'i-lucide-toggle-right', onSelect: () => setFilteredTracking(true) },
  { label: 'Desactivar resultados filtrados', icon: 'i-lucide-toggle-left', onSelect: () => setFilteredTracking(false) }
]
const trackingOptions = [
  { label: 'Todos los productos', value: 'all' },
  { label: 'Activo', value: 'enabled' },
  { label: 'Inactivo', value: 'disabled' }
]

function clearFilters() {
  search.value = ''
  tracking.value = 'all'
  productId.value = ''
}
</script>

<template>
  <section aria-labelledby="settings-tracking-title" class="min-w-0 space-y-4">
    <DetailSectionHeading title="Control de inventario" title-id="settings-tracking-title" description="Activa o desactiva el control interno por producto." />
    <DetailCard>
      <ListToolbar
        v-model:search="search"
        placeholder="Buscar código o producto"
        :has-active-filters="hasFilters"
        @clear="clearFilters"
      >
        <template #filters>
          <USelect
            v-model="tracking"
            :items="trackingOptions"
            aria-label="Control interno"
            class="w-full sm:w-52"
          />
        </template>
        <template #actions>
          <AppButton
            label="Actualizar"
            icon="i-lucide-refresh-cw"
            intent="secondary"
            :loading="status === 'idle' || status === 'pending'"
            @click="refresh()"
          />
          <UDropdownMenu :items="filteredActions">
            <AppButton
              label="Acciones sobre filtrados"
              icon="i-lucide-list-checks"
              trailing-icon="i-lucide-chevron-down"
              intent="secondary"
              :disabled="!canUpdateFiltered"
              :loading="busy"
            />
          </UDropdownMenu>
        </template>
      </ListToolbar>
      <p v-if="hasFilters" class="text-sm text-muted" aria-live="polite">
        Se aplicará a todos los resultados filtrados ({{ data?.pagination.totalResults ?? 0 }}), incluidas las demás páginas.
      </p>
      <UAlert v-if="error" :title="error" color="error" />
      <UAlert v-if="loadError" title="No se pudieron cargar los productos." color="error">
        <template #actions>
          <AppButton label="Reintentar" intent="secondary" @click="refresh()" />
        </template>
      </UAlert>
      <ListLoading v-else-if="status === 'idle' || status === 'pending'" />
      <UEmpty
        v-else-if="!data?.results.length"
        title="Sin productos para estos filtros"
        icon="i-lucide-package"
        variant="naked"
      />
      <ul v-else class="divide-y divide-default">
        <li v-for="product in data.results" :key="product.id" class="flex items-center justify-between gap-4 py-3">
          <div class="min-w-0">
            <p class="font-medium break-words">
              {{ product.name }}
            </p>
            <p class="text-sm break-words text-muted">
              {{ product.code }}<template v-if="product.unit">
                · {{ product.unit }}
              </template>
            </p>
          </div>
          <USwitch
            :model-value="product.enabled"
            :aria-label="`Control interno de ${product.name}`"
            :disabled="busy"
            class="shrink-0"
            @update:model-value="enabled => save({ action: 'tracking', productId: product.id, version: product.version, enabled })"
          />
        </li>
      </ul>
      <ListPagination
        v-if="data && !loadError"
        v-model:page="page"
        :total-results="data.pagination.totalResults"
        :page-size="25"
        :loading="status === 'pending' || busy"
        label="productos"
      />
    </DetailCard>
  </section>
</template>
