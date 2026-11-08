import type { ReportDailyMovement } from '~/types/reports'
import { formatMonth } from './datetime'

export function reportMonths(days: ReportDailyMovement[]) {
  const months = new Map<string, ReportDailyMovement & { start: string, end: string, days: number }>()
  const fields = ['sales', 'orderCount', 'counterSales', 'sellerSales', 'internalSales', 'collections', 'expenses', 'netCashFlow', 'materialPurchases', 'operatingExpenses', 'netProfit'] as const
  for (const day of days) {
    const key = day.date.slice(0, 7)
    const month = months.get(key)
    if (month) {
      month.end = day.date
      month.days++
      for (const field of fields) month[field] += day[field]
    } else {
      months.set(key, { ...day, date: `${key}-01`, label: formatMonth(`${key}-01`), start: day.date, end: day.date, days: 1 })
    }
  }
  return [...months.values()]
}

// Hide long inactive stretches only in annual visualizations; keep the source data for calculations.
export function reportVisibleMonths(days: ReportDailyMovement[]) {
  const months = reportMonths(days)
  const fields = ['sales', 'orderCount', 'counterSales', 'sellerSales', 'internalSales', 'collections', 'expenses', 'netCashFlow', 'materialPurchases', 'operatingExpenses', 'netProfit'] as const
  const hidden = new Set<string>()
  let runStart = 0
  for (let index = 0; index <= months.length; index++) {
    const month = months[index]
    if (month && fields.every(field => month[field] === 0)) continue
    if (index - runStart >= 6) {
      for (let empty = runStart; empty < index; empty++) hidden.add(months[empty]!.date)
    }
    runStart = index + 1
  }
  return months.filter(month => !hidden.has(month.date))
}

export function reportWeeks(days: ReportDailyMovement[]) {
  const weeks: { start: string, end: string, days: number, sales: number, orderCount: number, counterSales: number, sellerSales: number, internalSales: number, expenses: number, materialPurchases: number, operatingExpenses: number, netProfit: number }[] = []
  for (const day of days) {
    const monday = new Date(`${day.date}T00:00:00Z`)
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
    const key = monday.toISOString().slice(0, 10)
    let week = weeks.find(item => item.start === key)
    if (!week) {
      week = { start: key, end: day.date, days: 0, sales: 0, orderCount: 0, counterSales: 0, sellerSales: 0, internalSales: 0, expenses: 0, materialPurchases: 0, operatingExpenses: 0, netProfit: 0 }
      weeks.push(week)
    }
    week.end = day.date
    week.days++
    week.sales += day.sales
    week.orderCount += day.orderCount
    week.counterSales += day.counterSales
    week.sellerSales += day.sellerSales
    week.internalSales += day.internalSales
    week.expenses += day.expenses
    week.materialPurchases += day.materialPurchases
    week.operatingExpenses += day.operatingExpenses
    week.netProfit += day.netProfit
  }
  return weeks.map(week => ({ ...week, start: week.start < (days[0]?.date ?? '') ? days[0]!.date : week.start }))
}

export function reportDailyAverage(total: number, days: number) {
  return days > 0 ? total / days : 0
}

export { formatDate as reportShortDate } from './datetime'

function createReportCurrency() {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export const reportCurrency = createReportCurrency()
