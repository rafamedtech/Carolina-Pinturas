<script setup lang="ts" generic="T">
import type { TableColumn, TableSlots, TableProps } from '@nuxt/ui'
import type { VisibilityState } from '@tanstack/table-core'

defineOptions({ inheritAttrs: false })
const props = defineProps<{
  ui?: TableProps<T>['ui']
  data: T[]
  columns: TableColumn<T>[]
  empty?: string
  getRowId?: (row: T) => string
  loading?: boolean
}>()
const slots = defineSlots<TableSlots<T> & { record?(scope: { row: T }): unknown }>()
const tableSlotNames = () => Object.keys(slots).filter(name => name !== 'record' && name !== 'loading') as Array<keyof TableSlots<T>>
const columnVisibility = defineModel<VisibilityState>('columnVisibility', { default: () => ({}) })
const table = useTemplateRef('table')
defineExpose({ getColumns: () => table.value?.tableApi.getAllLeafColumns() ?? [] })
</script>

<template>
  <ListLoading :loading="Boolean(loading)" class="sr-only" />
  <div v-if="$slots.record" class="min-w-0 md:hidden">
    <slot v-if="loading" name="loading">
      <ListLoading :announce="false" />
    </slot>
    <div v-else-if="data.length" class="space-y-3">
      <template v-for="(row, index) in data" :key="getRowId?.(row) ?? index">
        <slot name="record" :row="row" />
      </template>
    </div>
    <slot v-else name="empty">
      <UEmpty
        icon="i-lucide-inbox"
        :title="empty || 'Sin registros'"
        variant="naked"
        class="py-10"
      />
    </slot>
  </div>
  <UTable
    ref="table"
    v-model:column-visibility="columnVisibility"
    v-bind="$attrs"
    :data="data"
    :columns="columns"
    :get-row-id="getRowId"
    :loading="loading"
    class="min-w-0 border-y border-default"
    :class="{ 'hidden md:block': $slots.record }"
    :ui="{ td: 'align-top', empty: 'p-0', ...props.ui }"
  >
    <template #loading="scope">
      <slot name="loading" v-bind="scope">
        <ListLoading :announce="false" />
      </slot>
    </template>
    <template v-for="name in tableSlotNames()" #[name]="scope">
      <slot :name="name" v-bind="scope" />
    </template>
    <template v-if="!$slots.empty" #empty>
      <UEmpty
        icon="i-lucide-inbox"
        :title="empty || 'Sin registros'"
        variant="naked"
        class="py-10"
      />
    </template>
  </UTable>
</template>
