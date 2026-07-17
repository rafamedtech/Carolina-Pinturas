import type { SalesDashboardSummary } from '~/types/dashboard'

export function useSalesDashboard() {
  return useFetch<SalesDashboardSummary>('/api/dashboard/summary', {
    key: 'sales-dashboard-summary',
    lazy: true
  })
}
