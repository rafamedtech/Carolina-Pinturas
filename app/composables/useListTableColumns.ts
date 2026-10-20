import { h } from 'vue'
import type { Column } from '@tanstack/table-core'
import { UButton } from '#components'

export function useListTableColumns<T>() {
  function sortableHeader(label: string, align: 'left' | 'right' = 'left') {
    const header = ({ column }: { column: Column<T, unknown> }) => {
      const direction = column.getIsSorted()
      const nextDirection = column.getNextSortingOrder()
      const directionLabel = direction === 'asc'
        ? 'ascendente'
        : direction === 'desc'
          ? 'descendente'
          : 'sin ordenar'
      const nextDirectionLabel = nextDirection === 'asc'
        ? 'ascendente'
        : nextDirection === 'desc'
          ? 'descendente'
          : 'quitar el orden'
      const actionLabel = direction
        ? `Cambiar ${label} a orden ${nextDirectionLabel}`
        : `Ordenar por ${label} ${nextDirectionLabel}`

      return h(UButton, {
        'label': label,
        'color': 'neutral',
        'variant': 'ghost',
        'size': 'sm',
        'class': align === 'right' ? 'w-full justify-end' : undefined,
        'trailingIcon': direction === 'asc'
          ? 'i-lucide-arrow-up'
          : direction === 'desc'
            ? 'i-lucide-arrow-down'
            : 'i-lucide-arrow-up-down',
        'aria-label': `${label}, ${directionLabel}. ${actionLabel}`,
        'title': actionLabel,
        'onClick': () => column.toggleSorting()
      })
    }
    return Object.assign(header, { columnLabel: label })
  }

  return { sortableHeader }
}
