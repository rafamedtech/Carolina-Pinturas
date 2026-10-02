import { formatDate } from '../../shared/utils/datetime'

const DAY_MS = 86_400_000

export function currentWeekBounds(now = new Date()) {
  // Las columnas de negocio son @db.Date: límites UTC para el día de México.
  const today = new Date(`${formatDate(now).split('/').reverse().join('-')}T00:00:00.000Z`)
  const daysSinceMonday = (today.getUTCDay() + 6) % 7
  const start = new Date(today.getTime() - daysSinceMonday * DAY_MS)
  const end = new Date(start.getTime() + 7 * DAY_MS)
  const previousStart = new Date(start.getTime() - 7 * DAY_MS)

  return { start, end, previousStart, elapsedDays: daysSinceMonday + 1, totalDays: 7 }
}
