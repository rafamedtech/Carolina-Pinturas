import type { BusinessReportSummary } from '~/types/reports'
import type { MaybeRefOrGetter } from 'vue'

export function useBusinessReports(month: MaybeRefOrGetter<string>) {
  return useFetch<BusinessReportSummary>('/api/reports/summary', {
    key: 'business-reports-summary',
    query: { month },
    lazy: true
  })
}
