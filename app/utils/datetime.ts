// The business operates in Mexico, and Vercel renders SSR in UTC. Formatting
// dates against a fixed timezone keeps server and client output identical,
// avoiding hydration mismatches, and shows the correct local time.
export const MEXICO_TIME_ZONE = 'America/Mexico_City'

export function formatMexicoDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: MEXICO_TIME_ZONE
  }).format(new Date(value))
}

export function formatMexicoDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeZone: MEXICO_TIME_ZONE
  }).format(new Date(value))
}

// Today's date (YYYY-MM-DD) in Mexico time, deterministic across server/client.
export function mexicoToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MEXICO_TIME_ZONE }).format(new Date())
}
