<script setup lang="ts" generic="T">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { getPaginationRowModel } from '@tanstack/table-core'
import type { PaginationState, SortingState, TableMeta, VisibilityState } from '@tanstack/table-core'

const props = withDefaults(defineProps<{
  data: T[]
  columns: TableColumn<T>[]
  loading?: boolean
  empty: string
  meta?: TableMeta<T>
  onSelect?: (event: Event, row: TableRow<T>) => void
  pageSize?: number
}>(), { pageSize: 25 })

const sorting = defineModel<SortingState>('sorting', { default: () => [] })
const columnVisibility = defineModel<VisibilityState>('columnVisibility', { default: () => ({}) })
// Only full local catalogs opt in. Server-paginated lists pass their current rows.
const page = defineModel<number>('page')
const pagination = computed<PaginationState>({
  get: () => ({ pageIndex: (page.value ?? 1) - 1, pageSize: props.pageSize }),
  set: (value) => { if (page.value !== undefined) page.value = value.pageIndex + 1 }
})
const paginationOptions = computed(() => page.value === undefined
  ? undefined
  : { getPaginationRowModel: getPaginationRowModel<T>() })

watch(() => props.data.length, (total) => {
  // An empty initial catalog can still be loading; preserve the URL's page then.
  if (page.value !== undefined && total > 0) {
    page.value = Math.min(page.value, Math.ceil(total / props.pageSize))
  }
}, { immediate: true })
const tableMeta = computed(() => props.meta ?? {})
</script>

<template>
  <div class="min-w-0 shrink-0" :aria-busy="loading">
    <AppTableSkeleton v-if="loading" :cols="columns.length" />
    <UTable
      v-else
      v-model:sorting="sorting"
      v-model:column-visibility="columnVisibility"
      v-model:pagination="pagination"
      :data="data"
      :columns="columns"
      :empty="empty"
      :meta="tableMeta"
      :on-select="onSelect"
      :pagination-options="paginationOptions"
      :auto-reset-page-index="false"
      :ui="{
        base: 'min-w-full border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'py-2 first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
        tr: 'data-[selectable=true]:cursor-pointer',
        separator: 'h-0'
      }"
    />
  </div>
</template>
