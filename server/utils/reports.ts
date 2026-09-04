const DAY_IN_MS = 86_400_000

export function reportNumeric(value: { toString(): string } | number | null | undefined) {
  return value == null ? 0 : Number(value.toString())
}

export function reportPercentage(amount: number, total: number) {
  return total > 0 ? Math.round((amount / total) * 1000) / 10 : 0
}

export function reportPercentageChange(current: number, previous: number) {
  return previous !== 0
    ? Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
    : null
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
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  const previousStart = new Date(Date.UTC(year, month - 1, 1))
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const isCurrentMonth = year === now.getUTCFullYear() && month === now.getUTCMonth()
  const elapsedDays = isCurrentMonth ? Math.min(now.getUTCDate(), totalDays) : totalDays

  return { start, end, previousStart, totalDays, elapsedDays, dayInMs: DAY_IN_MS }
}
