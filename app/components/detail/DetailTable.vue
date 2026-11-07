<script setup lang="ts" generic="T">
import type { TableColumn, TableSlots } from '@nuxt/ui'
import type { VisibilityState } from '@tanstack/table-core'

defineOptions({ inheritAttrs: false })
defineProps<{ data: T[], columns: TableColumn<T>[], empty?: string, getRowId?: (row: T) => string }>()
defineSlots<TableSlots<T>>()
const columnVisibility = defineModel<VisibilityState>('columnVisibility', { default: () => ({}) })
const table = useTemplateRef('table')
defineExpose({ getColumns: () => table.value?.tableApi.getAllLeafColumns() ?? [] })
</script>

<template>
  <UTable
    ref="table"
    v-model:column-visibility="columnVisibility"
    v-bind="$attrs"
    :data="data"
    :columns="columns"
    :get-row-id="getRowId"
    class="min-w-0 border-y border-default"
    :ui="{ td: 'align-top', empty: 'p-0' }"
  >
    <template v-for="(_, name) in $slots" #[name]="scope">
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
