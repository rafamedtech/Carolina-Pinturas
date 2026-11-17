<script setup lang="ts" generic="T">
import type { DropdownMenuItem, TableColumn, TableRow, TabsProps } from '@nuxt/ui'
import type { Column, SortingState, TableMeta, VisibilityState } from '@tanstack/table-core'
import type { ListFilterValues, ListLayoutConfig } from '~/types/list'
import { navigationIconForPath } from '~/utils/navigationIcons'
import type { OrderDateRange } from '~/types/orders'

const props = withDefaults(defineProps<{
  config: ListLayoutConfig
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  error?: boolean
  errorTitle?: string
  errorMessage?: string
  totalResults?: number
  filteredTotal?: number
  meta?: TableMeta<T>
  embedded?: boolean
  toolbarBelowTabs?: boolean
  tabsVariant?: TabsProps['variant']
  tabsFullWidth?: boolean
  hasExtraFilters?: boolean
  onSelect?: (event: Event, row: TableRow<T>) => void
}>(), { toolbarBelowTabs: undefined })
const route = useRoute()
const titleIcon = computed(() => props.config.tabs?.length ? navigationIconForPath(route.path) : undefined)
const emit = defineEmits<{ refresh: [], create: [], clear: [] }>()
const search = defineModel<string>('search', { default: '' })
const dateRange = defineModel<OrderDateRange | null>('dateRange', { default: null })
const filters = defineModel<ListFilterValues>('filters', { default: () => ({}) })
const tab = defineModel<string>('tab', { default: 'all' })
const page = defineModel<number>('page', { default: 1 })
const sorting = defineModel<SortingState>('sorting', { default: () => [] })
const columnVisibility = defineModel<VisibilityState>('columnVisibility', { default: () => ({}) })
type MobileRow = Pick<TableRow<T>, 'id' | 'original'>
const listTable = useTemplateRef<{
  getColumns: () => Column<T, unknown>[]
  getRows: () => MobileRow[] | undefined
}>('listTable')
const moreFiltersOpen = shallowRef(false)
const pageSize = computed(() => props.config.pagination?.pageSize ?? 25)
const tablePage = computed({
  get: () => props.config.pagination?.mode === 'client' ? page.value : undefined,
  set: (value) => { if (value !== undefined) page.value = value }
})
const mobileRows = computed(() => {
  const rows = listTable.value?.getRows()
  if (rows) return rows
  const start = ((tablePage.value ?? 1) - 1) * pageSize.value
  return (tablePage.value === undefined ? props.data : props.data.slice(start, start + pageSize.value))
    .map((original, index) => ({ id: String(start + index), original }))
})
const mobileSortItems = computed<DropdownMenuItem[]>(() => (listTable.value?.getColumns() ?? []).flatMap((column) => {
  const label = (column.columnDef.header as { columnLabel?: string } | undefined)?.columnLabel
  if (!label || !column.getCanSort()) return []
  return {
    label,
    icon: column.getIsSorted() === 'asc' ? 'i-lucide-arrow-up' : column.getIsSorted() === 'desc' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-up-down',
    onSelect: () => column.toggleSorting()
  }
}))
const hasActiveFilters = computed(() => Boolean(
  search.value || dateRange.value || props.hasExtraFilters
  || props.config.filters?.some(field => (filters.value[field.key] ?? field.defaultValue) !== field.defaultValue)
))
function clearFilters() {
  search.value = ''
  dateRange.value = null
  filters.value = Object.fromEntries((props.config.filters ?? []).map(field => [field.key, field.defaultValue]))
  page.value = 1
  emit('clear')
}
function applyFilters(value: ListFilterValues) {
  filters.value = value
  page.value = 1
}

defineSlots<{
  'actions'(): unknown
  'toolbar-actions'(): unknown
  'mobile'(props: { rows: T[] }): unknown
  'record'(props: { row: T }): unknown
  'content'(props: { rows: T[] }): unknown
  'before'(): unknown
  'after'(): unknown
  'overlays'(): unknown
}>()
</script>

<template>
  <ListPage
    :id="config.id"
    :title="config.title"
    :title-icon="titleIcon"
    :embedded="embedded"
    :views-before-toolbar="toolbarBelowTabs ?? Boolean(config.tabs?.length)"
    :loading="loading"
    :error="error"
    :error-title="errorTitle"
    :error-message="errorMessage"
    @refresh="emit('refresh')"
  >
    <template #actions>
      <slot name="actions" />
    </template>
    <template #toolbar>
      <slot name="before" />
      <ListToolbar
        v-if="config.search || config.dateFilter || config.filters?.length || config.create || columns.length"
        v-model:search="search"
        :placeholder="config.search?.placeholder"
        :has-active-filters="hasActiveFilters"
        @clear="clearFilters"
      >
        <template #filters>
          <div v-if="config.dateFilter || config.filters?.length" class="flex min-w-0 gap-2 md:contents">
            <OrdersOrderDateRangePicker v-if="config.dateFilter" v-model="dateRange" :subject="config.dateFilter.subject" />
            <AppButton
              v-if="config.filters?.length"
              label="Más filtros"
              icon="i-lucide-sliders-horizontal"
              intent="secondary"
              class="shrink-0 sm:justify-center"
              :class="config.dateFilter ? 'justify-center' : 'w-full justify-start sm:w-auto'"
              @click="moreFiltersOpen = true"
            />
          </div>
        </template>
        <template #actions>
          <slot name="toolbar-actions">
            <ListColumnPicker
              :columns="listTable?.getColumns() ?? []"
              :class="{ 'hidden md:inline-flex': $slots.mobile || $slots.record }"
            />
          </slot>
          <ListCreateButton v-if="config.create" :action="config.create" @create="emit('create')" />
        </template>
      </ListToolbar>
    </template>
    <template #views>
      <ListViews
        v-if="config.tabs?.length"
        v-model="tab"
        :items="config.tabs"
        :variant="tabsVariant"
        :full-width="tabsFullWidth"
        :label="`Filtrar ${config.title.toLowerCase()} por estado`"
      />
    </template>
    <ListLoading v-if="loading" />
    <template v-else>
      <slot name="content" :rows="data">
        <div v-if="$slots.mobile || $slots.record" class="md:hidden">
          <div v-if="$slots.record && mobileRows.length && mobileSortItems.length" class="mb-3 flex justify-end">
            <UDropdownMenu :items="mobileSortItems" :content="{ align: 'end' }">
              <AppButton
                intent="secondary"
                label="Ordenar"
                icon="i-lucide-arrow-up-down"
                size="sm"
              />
            </UDropdownMenu>
          </div>
          <slot name="mobile" :rows="mobileRows.map(row => row.original)">
            <div v-if="mobileRows.length" class="space-y-3">
              <template v-for="row in mobileRows" :key="row.id">
                <slot name="record" :row="row.original" />
              </template>
            </div>
            <UEmpty v-else icon="i-lucide-inbox" :title="config.empty" />
          </slot>
        </div>
        <ListTable
          ref="listTable"
          :key="config.id"
          v-model:page="tablePage"
          v-model:sorting="sorting"
          v-model:column-visibility="columnVisibility"
          :data="data"
          :columns="columns"
          :page-size="pageSize"
          :meta="meta"
          :empty="config.empty"
          :on-select="onSelect"
          :show-column-picker="false"
          :class="{ 'hidden md:block': $slots.mobile || $slots.record }"
        />
      </slot>
    </template>
    <template #pagination>
      <ListPagination
        v-if="config.pagination"
        v-model:page="page"
        :label="config.pagination.label"
        :total-results="totalResults ?? data.length"
        :filtered-total="filteredTotal"
        :total-label="config.pagination.totalLabel"
        :page-size="pageSize"
        :loading="loading"
      />
      <slot name="after" />
    </template>
    <template #overlays>
      <ListFiltersModal
        v-if="config.filters?.length"
        v-model:open="moreFiltersOpen"
        :fields="config.filters"
        :values="filters"
        @apply="applyFilters"
      />
      <slot name="overlays" />
    </template>
  </ListPage>
</template>
