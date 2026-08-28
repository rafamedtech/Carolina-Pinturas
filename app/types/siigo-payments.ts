export interface SiigoVoucherDocumentType {
  id: number
  code: string
  name: string
  active: boolean
  cost_center?: boolean
  cost_center_mandatory?: boolean
  cost_center_default?: number | null
  automatic_number?: boolean
  consecutive?: number
}

export interface SiigoPaymentType {
  id: number
  name: string
  type?: string
  active: boolean
  due_date?: boolean
}

export interface SiigoCostCenter {
  id: number
  name: string
  active?: boolean
}

export interface SiigoPayableInvoice {
  id: string
  name: string
  date: string
  total: number
  balance: number
  customerId: string | null
  customerRfc: string | null
  stampStatus: string | null
  stamped: boolean
}

export type OrderPaymentProvider = 'local' | 'siigo' | (string & {})
export type OrderPaymentExternalStatus = 'not_applicable' | 'pending' | 'synced' | 'failed' | 'unknown'

export interface OrderPayment {
  id: string
  requestId: string
  provider: OrderPaymentProvider
  externalStatus: OrderPaymentExternalStatus
  externalError: string | null
  paymentMethod: string
  amount: number
  currencyCode: string
  paymentDate: string
  reference: string | null
  observations: string | null
  siigo: {
    voucherId: string | null
    voucherName: string | null
    invoiceId: string
    invoiceName: string
    documentTypeId: number
    paymentTypeId: number
    costCenterId: number | null
    cfdiCode: string
    paymentMethod: 'PUE' | 'PPD'
    quote: number
  } | null
  createdBy: {
    name: string
    email: string
  }
  createdAt: string
}

export interface OrderPaymentContext {
  requiresInvoice: boolean
  orderTotal: number
  paidTotal: number
  balance: number
  payments: OrderPayment[]
  siigo: {
    available: boolean
    writeEnabled: boolean
    unavailableReason: string | null
    invoices: SiigoPayableInvoice[]
    documentTypes: SiigoVoucherDocumentType[]
    paymentTypes: SiigoPaymentType[]
    costCenters: SiigoCostCenter[]
  }
}

export interface CreateLocalOrderPaymentInput {
  destination: 'local'
  requestId: string
  paymentMethod: string
  amount: number
  date: string
  reference?: string | null
  observations?: string | null
}

export interface CreateOrderSiigoPaymentInput {
  destination: 'siigo'
  requestId: string
  invoiceId: string
  documentTypeId: number
  voucherNumber?: number | null
  paymentTypeId: number
  costCenterId?: number | null
  cfdiCode: string
  paymentMethod: 'PUE' | 'PPD'
  amount: number
  date: string
  quote: number
  observations?: string | null
  confirmation: 'CREAR_RECEPCION_SIIGO'
}

export interface CreateOrderSiigoReceiptInput {
  invoiceId: string
  documentTypeId: number
  voucherNumber?: number | null
  paymentTypeId: number
  costCenterId?: number | null
  cfdiCode: string
  paymentMethod: 'PUE' | 'PPD'
  quote: number
  confirmation: 'CREAR_RECEPCION_SIIGO'
}

export type CreateOrderPaymentInput = CreateLocalOrderPaymentInput
