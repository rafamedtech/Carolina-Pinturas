import { addReportGroup, rankReportAmounts, reportPercentage as percentageFromPositiveBase, utcPeriodBounds } from '@rafamedtech/nuxt-shared/utils'

export { reportPercentage as reportMargin, reportPercentageChange } from '@rafamedtech/nuxt-shared/utils'

export function reportNumeric(value: { toString(): string } | number | null | undefined) {
  return value == null ? 0 : Number(value.toString())
}

export function reportSalesBeforeTax(order: {
  total: { toString(): string } | number
  taxTotal: { toString(): string } | number
}) {
  return reportNumeric(order.total) - reportNumeric(order.taxTotal)
}

export function reportPercentage(amount: number, total: number) {
  return percentageFromPositiveBase(amount, total) ?? 0
}

export function reportDateOnly(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function reportMonthBounds(selectedMonth: string | undefined, now = new Date()) {
  if (selectedMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)) {
    throw createError({ statusCode: 400, statusMessage: 'El mes seleccionado no es válido.' })
  }

  const [selectedYear, selectedMonthNumber] = selectedMonth?.split('-').map(Number) ?? []
  const year = selectedYear ?? now.getUTCFullYear()
  const month = selectedMonthNumber ? selectedMonthNumber - 1 : now.getUTCMonth()
  const bounds = utcPeriodBounds(year, month + 1)
  const { start, totalDays } = bounds
  const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth()
  const elapsedDays = start > now ? 0 : isCurrentMonth ? Math.min(now.getUTCDate(), totalDays) : totalDays

  return { ...bounds, elapsedDays }
}

export function reportYearBounds(selectedYear: string | undefined, now = new Date()) {
  if (selectedYear !== undefined && (!/^\d{4}$/.test(selectedYear) || Number(selectedYear) < 1000 || Number(selectedYear) > 9998)) {
    throw createError({ statusCode: 400, statusMessage: 'El año seleccionado no es válido.' })
  }

  const year = selectedYear === undefined ? now.getUTCFullYear() : Number(selectedYear)
  const bounds = utcPeriodBounds(year)
  const { start, totalDays, dayInMs } = bounds
  const elapsedDays = start > now
    ? 0
    : year === now.getUTCFullYear()
      ? Math.floor((now.getTime() - start.getTime()) / dayInMs) + 1
      : totalDays

  return { ...bounds, elapsedDays }
}

// Match the customer-based classification used by the order list.
export function reportIsCounterSale(customerName: string) {
  return ['MOSTRADOR', 'MOSTRADOR .'].includes(customerName.toUpperCase())
}

export function reportSalesChannel(order: {
  customerNameSnapshot: string
  customer: { isInternalOrderCustomer: boolean }
}): 'counter' | 'seller' | 'internal' {
  if (order.customer.isInternalOrderCustomer) return 'internal'
  return reportIsCounterSale(order.customerNameSnapshot) ? 'counter' : 'seller'
}

export function reportTopDebtors(orders: readonly {
  customerId: string
  customerNameSnapshot: string
  total: { toString(): string } | number
  payments: readonly { amount: { toString(): string } | number }[]
}[]) {
  const customers = new Map<string, { id: string, label: string, detail: string, amount: number, count: number }>()
  let totalOutstanding = 0

  for (const order of orders) {
    const paid = order.payments.reduce((sum, payment) => sum + reportNumeric(payment.amount), 0)
    const outstanding = Math.max(reportNumeric(order.total) - paid, 0)
    if (outstanding <= 0) continue

    addReportGroup(customers, order.customerId, outstanding, () => ({
      id: order.customerId,
      label: order.customerNameSnapshot,
      detail: 'Saldo pendiente',
      amount: 0,
      count: 0
    }))
    totalOutstanding += outstanding
  }

  return rankReportAmounts(customers.values(), 5, (a, b) => a.label.localeCompare(b.label))
    .map(customer => ({ ...customer, percentage: reportPercentage(customer.amount, totalOutstanding) }))
}
