import { addCalendarDays, calendarDateKeyInTimeZone, calendarDaysInclusive, calendarWeekStart } from '@rafamedtech/nuxt-shared/utils'
import { MEXICO_TIME_ZONE } from '../../shared/utils/datetime'

export function currentWeekBounds(now = new Date()) {
  // Las columnas de negocio son @db.Date: límites UTC para el día de México.
  const today = calendarDateKeyInTimeZone(now, MEXICO_TIME_ZONE)
  const monday = calendarWeekStart(today)
  return {
    start: new Date(monday),
    end: new Date(addCalendarDays(monday, 7)),
    previousStart: new Date(addCalendarDays(monday, -7)),
    elapsedDays: calendarDaysInclusive(monday, today),
    totalDays: 7
  }
}
