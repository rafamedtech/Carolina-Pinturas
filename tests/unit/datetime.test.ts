import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatDate, formatDateTime, formatDateRange, formatMexicoDate, formatMexicoDateTime, mexicoToday } from '../../app/utils/datetime'
import { formatDate as sharedFormatDate } from '../../shared/utils/datetime'
import { dashboardDate } from '../../app/utils/dashboardFormatters'
import { purchaseDateLabel } from '../../app/utils/purchaseFormat'

afterEach(() => vi.useRealTimers())

describe('formatMexicoDate', () => {
  it('formatea una fecha válida para México', () => {
    expect(formatMexicoDate('2026-08-18T17:00:00.000Z')).toBe('18/08/2026')
  })

  it('interpreta como UTC las fechas de Siigo que no incluyen zona horaria', () => {
    expect(formatMexicoDate('2026-07-29T00:57:28.537')).toBe('28/07/2026')
  })

  it('oculta la fecha centinela sin valor de Siigo', () => {
    expect(formatMexicoDate('0001-01-01T00:00:00.000Z')).toBe('—')
  })

  it('oculta fechas inválidas', () => {
    expect(formatMexicoDate('fecha-inválida')).toBe('—')
  })
})

describe('formato compartido de fechas', () => {
  it.each(['2026-01-01', '2026-10-02', '2024-02-29'])('conserva el día de negocio de %s', (value) => {
    const expected = value.split('-').reverse().join('/')
    expect(formatDate(value)).toBe(expected)
    expect(formatDateTime(value)).toBe(expected)
    expect(dashboardDate(value)).toBe(expected)
    expect(purchaseDateLabel(value)).toBe(expected)
  })

  it.each([null, undefined, '', 'inválida', '2026-02-29', '2026-04-31', '2026-13-01', '2026-02-30T12:00:00Z', '0001-01-01', new Date('inválida')])('oculta valores ausentes, inválidos o centinela: %s', (value) => {
    expect(formatDate(value)).toBe('—')
    expect(formatDateTime(value)).toBe('—')
  })

  it('comparte la misma implementación entre el cliente, el servidor y los alias anteriores', () => {
    expect(formatDate).toBe(sharedFormatDate)
    expect(formatMexicoDate).toBe(formatDate)
    expect(formatMexicoDateTime).toBe(formatDateTime)
  })

  it('muestra año completo y hora de México en cambios de año', () => {
    expect(formatDateTime('2026-01-01T02:05:00Z')).toBe('31/12/2025, 20:05')
    expect(formatDateTime('2026-01-01T02:05:00')).toBe('31/12/2025, 20:05')
    expect(formatDateTime(new Date('2026-01-01T02:05:00Z'))).toBe('31/12/2025, 20:05')
    expect(formatDateTime('2026-01-01T00:05:00-06:00')).toBe('01/01/2026, 00:05')
  })

  it('formatea ambos extremos del rango y evita duplicar un mismo día', () => {
    expect(formatDateRange('2026-09-30', '2026-10-02')).toBe('30/09/2026 – 02/10/2026')
    expect(formatDateRange('2026-10-02', '2026-10-02')).toBe('02/10/2026')
    expect(formatDateRange('2026-10-02', null)).toBe('—')
  })

  it('conserva YYYY-MM-DD para los valores internos de hoy en México', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T02:05:00Z'))
    expect(mexicoToday()).toBe('2025-12-31')
  })
})
