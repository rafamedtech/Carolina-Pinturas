import type { OrderPaymentExternalStatus, OrderPaymentProvider } from './siigo-payments'

export interface PaymentListItem {
  id: string
  order: {
    id: string
    number: string
    customerName: string
  }
  provider: OrderPaymentProvider
  externalStatus: OrderPaymentExternalStatus
  paymentMethod: string
  amount: number
  currencyCode: string
  paymentDate: string
  reference: string | null
  observations: string | null
  siigoVoucherName: string | null
  createdBy: {
    name: string
    email: string
  }
  createdAt: string
}

export interface PaymentListResponse {
  results: PaymentListItem[]
  filteredTotal: number
  pagination: {
    page: number
    pageSize: number
    totalResults: number
    totalPages: number
  }
}
