import type { ReportDailyMovement } from '~/types/reports'

export function reportWeeks(days: ReportDailyMovement[]) {
  const weeks: { start: string, end: string, days: number, sales: number, orderCount: number, counterSales: number, sellerSales: number, expenses: number }[] = []
  for (const day of days) {
    const monday = new Date(`${day.date}T00:00:00Z`)
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
    const key = monday.toISOString().slice(0, 10)
    let week = weeks.find(item => item.start === key)
    if (!week) {
      week = { start: key, end: day.date, days: 0, sales: 0, orderCount: 0, counterSales: 0, sellerSales: 0, expenses: 0 }
      weeks.push(week)
    }
    week.end = day.date
    week.days++
    week.sales += day.sales
    week.orderCount += day.orderCount
    week.counterSales += day.counterSales
    week.sellerSales += day.sellerSales
    week.expenses += day.expenses
  }
  return weeks.map(week => ({ ...week, start: week.start < (days[0]?.date ?? '') ? days[0]!.date : week.start }))
}

export function reportDailyAverage(total: number, days: number) {
  return days > 0 ? total / days : 0
}

export function reportShortDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

function createReportCurrency() {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export const reportCurrency = createReportCurrency()
