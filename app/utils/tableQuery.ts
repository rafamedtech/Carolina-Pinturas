import { tableQueryRange as bindTableQueryRange, type TableDateRange } from '@rafamedtech/nuxt-shared/utils'
import type { Ref } from 'vue'

export {
  tableQueryBoolean,
  tableQueryDate,
  tableQueryField,
  tableQueryPage,
  tableQuerySorting,
  tableQueryText,
  tableReturnPath
} from '@rafamedtech/nuxt-shared/utils'

export function tableQueryRange(state: Ref<TableDateRange | null>, from = 'date_from', to = 'date_to') {
  return bindTableQueryRange(state, from, to)
}

export function tableReturnQuery(path: string) {
  const queryStart = path.indexOf('?')
  return new URLSearchParams(queryStart === -1 ? '' : path.slice(queryStart + 1).split('#')[0])
}

export function tableTabBreadcrumb(items: readonly { value: string, label: string, icon?: string }[], value: string | null, fallback: string) {
  const tab = items.find(item => item.value === value) ?? items.find(item => item.value === fallback)
  return tab && { label: tab.label, icon: tab.icon }
}
