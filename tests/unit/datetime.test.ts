import { describe, expect, it } from 'vitest'
import { formatMexicoDate } from '../../app/utils/datetime'

describe('formatMexicoDate', () => {
  it('formatea una fecha válida para México', () => {
    expect(formatMexicoDate('2026-08-18T17:00:00.000Z')).toBe('18 ago 2026')
  })

  it('interpreta como UTC las fechas de Siigo que no incluyen zona horaria', () => {
    expect(formatMexicoDate('2026-07-29T00:57:28.537')).toBe('28 jul 2026')
  })

  it('oculta la fecha centinela sin valor de Siigo', () => {
    expect(formatMexicoDate('0001-01-01T00:00:00.000Z')).toBe('—')
  })

  it('oculta fechas inválidas', () => {
    expect(formatMexicoDate('fecha-inválida')).toBe('—')
  })
})
