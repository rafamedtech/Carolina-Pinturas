import {
  buildReportFlowSeries,
  reportMonths as groupReportMonths,
  reportVisibleMonths as filterReportMonths,
  reportWeeks as groupReportWeeks
} from '@rafamedtech/nuxt-shared/utils'
import type { ReportDailyMovement } from '~/types/reports'
import { formatDateRange, formatMonth } from './datetime'

const weeklyMetrics = [
  'sales',
  'orderCount',
  'counterSales',
  'sellerSales',
  'internalSales',
  'expenses',
  'materialPurchases',
  'operatingExpenses',
  'netProfit'
] as const
const monthlyMetrics = [...weeklyMetrics, 'collections', 'netCashFlow'] as const

export function reportWeeks(days: ReportDailyMovement[]) {
  return groupReportWeeks(days, weeklyMetrics)
}

export function reportMonths(days: ReportDailyMovement[]) {
  return groupReportMonths(days, monthlyMetrics, formatMonth)
}

export function reportVisibleMonths(days: ReportDailyMovement[]) {
  return filterReportMonths(days, monthlyMetrics, formatMonth)
}

export function reportFlowSeries(days: ReportDailyMovement[], annual = false) {
  return buildReportFlowSeries(days, {
    annual,
    weeklyMetrics,
    monthlyMetrics,
    formatMonth,
    formatWeek: (start, end) => formatDateRange(start, end, 'short')
  })
}

export { formatDate as reportShortDate } from './datetime'
export { reportCurrency, reportDailyAverage } from '@rafamedtech/nuxt-shared/utils'
