// The business operates in Mexico, and Vercel renders SSR in UTC. Formatting
// dates against a fixed timezone keeps server and client output identical,
// avoiding hydration mismatches, and shows the correct local time.
export const MEXICO_TIME_ZONE = 'America/Mexico_City'

function externalDate(value: string) {
  // Siigo documenta sus timestamps en UTC, pero los devuelve sin `Z`.
  // Agregarla evita que Node y el navegador los interpreten en su zona local.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value}Z`
    : value

  return new Date(normalized)
}

export function formatMexicoDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: MEXICO_TIME_ZONE
  }).format(externalDate(value))
}

export function formatMexicoDate(value: string) {
  const date = externalDate(value)

  // Siigo puede devolver 0001-01-01 cuando la entidad no tiene una fecha real.
  // No presentar ese valor centinela como "1 ene 1".
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() <= 1) return '—'

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeZone: MEXICO_TIME_ZONE
  }).format(date)
}

// Today's date (YYYY-MM-DD) in Mexico time, deterministic across server/client.
export function mexicoToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MEXICO_TIME_ZONE }).format(new Date())
}
