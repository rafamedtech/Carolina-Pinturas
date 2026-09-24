export interface CsvColumn<T = unknown> {
  key: string
  label: string
  value?(row: T): unknown
}

function serializeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const header = columns.map(column => escapeCsvCell(column.label)).join(',')
  const body = rows.map(row => columns.map((column) => {
    const value = column.value
      ? column.value(row)
      : (row as Record<string, unknown>)[column.key]
    return escapeCsvCell(serializeCsvValue(value))
  }).join(','))

  return [header, ...body].join('\r\n')
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function csvFilename(base: string, date = new Date()): string {
  const slug = base
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${slug || 'exportacion'}-${date.toISOString().slice(0, 10)}.csv`
}
