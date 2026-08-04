import type { SalesDashboardSummary } from '~/types/dashboard'
import type { MaybeRefOrGetter } from 'vue'

export function useSalesDashboard(month: MaybeRefOrGetter<string>) {
  return useFetch<SalesDashboardSummary>('/api/dashboard/summary', {
    key: 'sales-dashboard-summary',
    query: { month },
    lazy: true
  })
}
