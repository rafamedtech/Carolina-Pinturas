import type { PaymentMethodKey } from '~/utils/orderPayment'
import type { ExpenseCategory, ExpenseCurrencyCode } from '~/utils/expense'

export interface CreateExpenseInput {
  date: string
  category: ExpenseCategory
  description: string
  providerId: string
  currencyCode: ExpenseCurrencyCode
  exchangeRate: number
  amount: number
  paymentMethod: PaymentMethodKey
  notes: string
}

export interface ExpenseRecord extends Omit<CreateExpenseInput, 'notes'> {
  id: string
  provider: string
  providerRfc: string | null
  notes: string | null
  createdBy: {
    name: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

export interface ExpenseListResponse {
  results: ExpenseRecord[]
  filteredTotal: number
  pagination: {
    page: number
    pageSize: number
    totalResults: number
    totalPages: number
  }
}
