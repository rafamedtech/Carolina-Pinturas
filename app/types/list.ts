import type { ButtonProps, DropdownMenuItem } from '@nuxt/ui'

export type ListFilterValue = string | boolean
export type ListFilterValues = Record<string, ListFilterValue>
export type ListFilterDefinition = {
  key: string
  label: string
} & ({
  type: 'select'
  defaultValue: string
  items: Array<{ label: string, value: string }>
} | {
  type: 'checkbox'
  defaultValue: boolean
} | {
  type: 'date'
  defaultValue: string
})

export interface ListCreateAction {
  label?: string
  icon?: string
  to?: ButtonProps['to']
  items?: DropdownMenuItem[] | DropdownMenuItem[][]
  disabled?: boolean
  reason?: string
}

export interface ListLayoutConfig {
  id: string
  title: string
  empty: string
  search?: { placeholder: string }
  dateFilter?: { subject: string }
  filters?: ListFilterDefinition[]
  tabs?: Array<{ label: string, value: string }>
  defaultTab?: string
  create?: ListCreateAction
  pagination?: {
    mode: 'client' | 'server' | 'external'
    label: string
    pageSize?: number
    totalLabel?: string
  }
}
