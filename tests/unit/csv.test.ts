import { describe, expect, it } from 'vitest'
import type { CsvColumn } from '@rafamedtech/nuxt-shared/utils'
import { csvFilename, toCsv } from '@rafamedtech/nuxt-shared/utils'
import { formatDateTime } from '../../app/utils/datetime'

interface Row {
  name: string
  amount: number | null
  note?: string
}

const columns: CsvColumn<Row>[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'amount', label: 'Importe', value: row => row.amount },
  { key: 'note', label: 'Nota', value: row => row.note }
]

describe('toCsv', () => {
  it('writes the header and serializes values', () => {
    const csv = toCsv(columns, [{ name: 'Pintura', amount: 120, note: 'ok' }])

    expect(csv).toBe('Nombre,Importe,Nota\r\nPintura,120,ok')
  })

  it('escapes commas, quotes and newlines', () => {
    const csv = toCsv(columns, [{ name: 'Rojo, "brillante"', amount: null, note: 'a\nb' }])

    expect(csv).toBe('Nombre,Importe,Nota\r\n"Rojo, ""brillante""",,"a\nb"')
  })

  it('renders empty strings for null and undefined values', () => {
    const csv = toCsv(columns, [{ name: 'Thinner', amount: null }])

    expect(csv).toBe('Nombre,Importe,Nota\r\nThinner,,')
  })

  it('exports Date values with the shared date and time format', () => {
    expect(toCsv([{ key: 'date', label: 'Fecha' }], [{ date: new Date('2026-10-02T18:05:00Z') }], formatDateTime))
      .toBe('Fecha\r\n"02/10/2026, 12:05"')
  })
})

describe('csvFilename', () => {
  it('slugifies the base name and stamps the date', () => {
    expect(csvFilename('Gastos Operativos', new Date('2026-09-24T12:00:00Z')))
      .toBe('gastos-operativos-2026-09-24.csv')
  })

  it('falls back to a default name', () => {
    expect(csvFilename('   ', new Date('2026-09-24T12:00:00Z')))
      .toBe('exportacion-2026-09-24.csv')
  })
})
