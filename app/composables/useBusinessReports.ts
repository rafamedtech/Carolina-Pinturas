import type { BusinessReportSummary } from '~/types/reports'
import type { MaybeRefOrGetter } from 'vue'

export function useBusinessReports(month: MaybeRefOrGetter<string>, view: MaybeRefOrGetter<'monthly' | 'annual'>) {
  return useFetch<BusinessReportSummary>('/api/reports/summary', {
    server: false,
    key: 'business-reports-summary',
    query: computed(() => toValue(view) === 'annual'
      ? { view: 'annual', year: toValue(month).slice(0, 4) }
      : { month: toValue(month) }),
    lazy: true
  })
}
