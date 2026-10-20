<script setup lang="ts" generic="T">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Column } from '@tanstack/table-core'

const props = defineProps<{ columns: Column<T, unknown>[] }>()

const items = computed<DropdownMenuItem[]>(() => {
  const visibleCount = props.columns.filter(column => column.getIsVisible()).length
  return props.columns.filter(column => column.getCanHide()).map((column) => {
    const header = column.columnDef.header
    const label = typeof header === 'string'
      ? header
      : (header as { columnLabel?: string } | undefined)?.columnLabel || column.id
    return {
      label,
      type: 'checkbox',
      checked: column.getIsVisible(),
      disabled: column.getIsVisible() && visibleCount <= 1,
      onUpdateChecked: (checked: boolean) => column.toggleVisibility(checked),
      onSelect: (event: Event) => event.preventDefault()
    }
  })
})
</script>

<template>
  <UDropdownMenu v-if="items.length" :items="items" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-columns-3"
      color="neutral"
      variant="outline"
      aria-label="Personalizar columnas"
      title="Personalizar columnas"
    />
  </UDropdownMenu>
</template>
