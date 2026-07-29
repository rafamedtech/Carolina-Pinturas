export const dashboardCurrency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0
})

export const dashboardNumber = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 1
})

export function dashboardCompactCurrency(value: number) {
  const absoluteValue = Math.abs(value)

  if (absoluteValue < 1_000) {
    return dashboardCurrency.format(value)
  }

  const isMillions = absoluteValue >= 1_000_000
  const divisor = isMillions ? 1_000_000 : 1_000
  const suffix = isMillions ? 'M' : 'k'
  const sign = value < 0 ? '-' : ''

  return `${sign}$${dashboardNumber.format(absoluteValue / divisor)} ${suffix}`
}

export function dashboardDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(new Date(`${value}T00:00:00.000Z`))
}
