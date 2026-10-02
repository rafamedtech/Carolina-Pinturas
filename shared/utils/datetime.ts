// Una zona fija mantiene iguales las fechas de SSR y del navegador.
export const MEXICO_TIME_ZONE = 'America/Mexico_City'

export type DateInput = string | Date | null | undefined

const dateFormatters = {
  UTC: new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
  }),
  mexico: new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: MEXICO_TIME_ZONE
  })
}
const timeFormatter = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: MEXICO_TIME_ZONE
})

function parseDisplayDate(value: DateInput) {
  if (!value) return null

  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (typeof value === 'string') {
    // Rechazar días inexistentes antes de que Date los normalice al mes siguiente.
    const calendarDate = value.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/)?.[1]
    if (calendarDate) {
      const parsed = new Date(`${calendarDate}T00:00:00.000Z`)
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== calendarDate) return null
    }
  }

  // Siigo devuelve timestamps UTC sin Z; nunca usar la zona local del equipo.
  const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
    ? `${value}Z`
    : value
  const date = normalized instanceof Date ? normalized : new Date(normalized)

  // Siigo usa el año 0001 como centinela cuando falta una fecha real.
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1) return null
  return { date, formatter: dateOnly ? dateFormatters.UTC : dateFormatters.mexico }
}

/** DD/MM/AAAA. Las fechas YYYY-MM-DD conservan su día; los timestamps usan la zona de México. */
export function formatDate(value: DateInput): string {
  const parsed = parseDisplayDate(value)
  if (!parsed) return '—'

  const parts = parsed.formatter.formatToParts(parsed.date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)!.value
  return `${part('day')}/${part('month')}/${part('year').padStart(4, '0')}`
}

/** DD/MM/AAAA, HH:mm para los registros que también necesitan mostrar la hora. */
export function formatDateTime(value: DateInput): string {
  const parsed = parseDisplayDate(value)
  if (!parsed) return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value)
  return `${formatDate(value)}, ${timeFormatter.format(parsed.date)}`
}

export function formatDateRange(start: DateInput, end: DateInput): string {
  const from = formatDate(start)
  const to = formatDate(end)
  if (from === '—' || to === '—') return '—'
  return from === to ? from : `${from} – ${to}`
}

// Valor interno para calendarios, filtros, API y base de datos: YYYY-MM-DD.
export function mexicoToday(): string {
  return formatDate(new Date()).split('/').reverse().join('-')
}
