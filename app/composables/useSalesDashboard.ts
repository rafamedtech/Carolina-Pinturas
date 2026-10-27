import type { SalesDashboardSummary } from '~/types/dashboard'

export function useSalesDashboard() {
  return useFetch<SalesDashboardSummary>('/api/dashboard/summary', {
    server: false,
    key: 'sales-dashboard-week-summary',
    lazy: true
  })
}
