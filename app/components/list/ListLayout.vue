<script setup lang="ts" generic="T">
import type { TableColumn, TableRow } from '@nuxt/ui'
import type { SortingState, TableMeta, VisibilityState } from '@tanstack/table-core'
import type { ListFilterValues, ListLayoutConfig } from '~/types/list'
import type { OrderDateRange } from '~/types/orders'

const props = defineProps<{
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
  onSelect?: (event: Event, row: TableRow<T>) => void
}>()
const emit = defineEmits<{ refresh: [], create: [], clear: [] }>()
const search = defineModel<string>('search', { default: '' })
const dateRange = defineModel<OrderDateRange | null>('dateRange', { default: null })
const filters = defineModel<ListFilterValues>('filters', { default: () => ({}) })
const tab = defineModel<string>('tab', { default: 'all' })
const page = defineModel<number>('page', { default: 1 })
const sorting = defineModel<SortingState>('sorting', { default: () => [] })
const columnVisibility = defineModel<VisibilityState>('columnVisibility', { default: () => ({}) })
const listTable = useTemplateRef('listTable')
const moreFiltersOpen = shallowRef(false)
const pageSize = computed(() => props.config.pagination?.pageSize ?? 25)
const tablePage = computed({
  get: () => props.config.pagination?.mode === 'client' ? page.value : undefined,
  set: (value) => { if (value !== undefined) page.value = value }
})
const hasActiveFilters = computed(() => Boolean(
  search.value || dateRange.value
  || (props.config.tabs?.length && tab.value !== (props.config.defaultTab ?? 'all'))
  || props.config.filters?.some(field => (filters.value[field.key] ?? field.defaultValue) !== field.defaultValue)
))
function clearFilters() {
  search.value = ''
  dateRange.value = null
  tab.value = props.config.defaultTab ?? 'all'
  filters.value = Object.fromEntries((props.config.filters ?? []).map(field => [field.key, field.defaultValue]))
  page.value = 1
  emit('clear')
}
function applyFilters(value: ListFilterValues) {
  filters.value = value
  page.value = 1
}

defineSlots<{
  actions(): unknown
  mobile(props: { rows: T[] }): unknown
  content(props: { rows: T[] }): unknown
  before(): unknown
  after(): unknown
  overlays(): unknown
}>()
</script>

<template>
  <ListPage
    :id="config.id"
    :title="config.title"
    :embedded="embedded"
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
          <OrdersOrderDateRangePicker v-if="config.dateFilter" v-model="dateRange" :subject="config.dateFilter.subject" />
          <UButton
            v-if="config.filters?.length"
            label="Más filtros"
            icon="i-lucide-sliders-horizontal"
            color="neutral"
            variant="outline"
            class="w-full justify-start sm:w-auto sm:justify-center"
            @click="moreFiltersOpen = true"
          />
        </template>
        <template #actions>
          <ListColumnPicker
            :columns="listTable?.getColumns() ?? []"
            :class="{ 'hidden md:inline-flex': $slots.mobile }"
          />
          <ListCreateButton v-if="config.create" :action="config.create" @create="emit('create')" />
        </template>
      </ListToolbar>
    </template>
    <template #views>
      <ListViews
        v-if="config.tabs?.length"
        v-model="tab"
        :items="config.tabs"
        :label="`Filtrar ${config.title.toLowerCase()} por estado`"
      />
    </template>
    <ListLoading v-if="loading" />
    <template v-else>
      <slot name="content" :rows="data">
        <div v-if="$slots.mobile" class="md:hidden">
          <slot name="mobile" :rows="data" />
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
          :class="{ 'hidden md:block': $slots.mobile }"
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
