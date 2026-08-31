import type { UserRole } from '~/types/siigo'

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

export const ADMIN_ONLY_EXPENSE_CATEGORIES = [
  'Nómina y honorarios'
] as const satisfies readonly ExpenseCategory[]

export function canViewExpenseCategory(role: UserRole, category: string) {
  return role === 'admin'
    || !ADMIN_ONLY_EXPENSE_CATEGORIES.includes(category as typeof ADMIN_ONLY_EXPENSE_CATEGORIES[number])
}

export function visibleExpenseCategories(role: UserRole): readonly ExpenseCategory[] {
  return EXPENSE_CATEGORIES.filter(category => canViewExpenseCategory(role, category))
}
