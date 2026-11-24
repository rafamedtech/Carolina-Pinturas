import { calendarDateKeyInTimeZone, createDateFormatters, type DateInput } from '@rafamedtech/nuxt-shared/utils'

export type { DateInput } from '@rafamedtech/nuxt-shared/utils'

export const MEXICO_TIME_ZONE = 'America/Mexico_City'

const numericDate = { day: '2-digit', month: '2-digit', year: 'numeric' } as const
const dates = createDateFormatters({
  timeZone: MEXICO_TIME_ZONE,
  date: numericDate,
  dateTime: { ...numericDate, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
})

function normalizeSiigoDate(value: DateInput): DateInput {
  if (!value) return value

  // Siigo envía timestamps UTC sin Z y usa el año 0001 para fechas ausentes.
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
    ? `${value}Z`
    : value
  const date = normalized instanceof Date ? normalized : new Date(normalized)
  return date.getUTCFullYear() <= 1 ? null : normalized
}

export function formatDate(value: DateInput): string {
  return dates.formatDate(normalizeSiigoDate(value))
}

export function formatDateTime(value: DateInput): string {
  return dates.formatDateTime(normalizeSiigoDate(value))
}

export function formatMonth(value: DateInput): string {
  return dates.formatMonth(normalizeSiigoDate(value))
}

const shortMonths = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function formatCompactDate(value: DateInput) {
  const [day, month] = dates.formatDate(value).split('/')
  return `${Number(day)} ${shortMonths[Number(month) - 1]}`
}

export function formatDateRange(start: DateInput, end: DateInput, format: 'numeric' | 'short' = 'numeric'): string {
  const from = normalizeSiigoDate(start)
  const to = normalizeSiigoDate(end)
  return format === 'short'
    ? dates.formatDateRange(from, to, formatCompactDate, ' - ')
    : dates.formatDateRange(from, to)
}

// Valor interno para calendarios, filtros, API y base de datos: YYYY-MM-DD.
export function mexicoToday(): string {
  return calendarDateKeyInTimeZone(new Date(), MEXICO_TIME_ZONE)
}
