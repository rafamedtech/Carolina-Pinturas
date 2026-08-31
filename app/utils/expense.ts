export const EXPENSE_CATEGORIES = [
  'Compra de materiales',
  'Renta y servicios',
  'Transporte y combustible',
  'Mantenimiento',
  'Nómina y honorarios',
  'Publicidad',
  'Impuestos',
  'Otros'
] as const

export const EXPENSE_CURRENCIES = [
  { label: 'Peso mexicano (MXN)', value: 'MXN' },
  { label: 'Dólar estadounidense (USD)', value: 'USD' }
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]
export type ExpenseCurrencyCode = typeof EXPENSE_CURRENCIES[number]['value']
