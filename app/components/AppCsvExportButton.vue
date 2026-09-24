<script setup lang="ts">
import type { CsvColumn } from '~/utils/csv'

const props = withDefaults(defineProps<{
  filename: string
  columns: CsvColumn[]
  rows?: readonly unknown[]
  fetchAll?: () => Promise<readonly unknown[]>
  disabled?: boolean
  label?: string
}>(), {
  rows: undefined,
  fetchAll: undefined,
  disabled: false,
  label: 'Exportar CSV'
})

const { exporting, exportCsv } = useCsvExport<unknown>({
  filename: () => props.filename,
  columns: () => props.columns,
  rows: () => props.rows,
  fetchAll: props.fetchAll ? () => props.fetchAll!() : undefined
})
</script>

<template>
  <UButton
    :label="label"
    icon="i-lucide-file-down"
    color="neutral"
    variant="outline"
    :loading="exporting"
    :disabled="disabled || exporting"
    :ui="{ label: 'hidden sm:inline' }"
    @click="exportCsv"
  />
</template>
