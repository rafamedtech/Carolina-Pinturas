import type { SiigoCostCenter, SiigoPaymentType } from './siigo-payments'
import type { SiigoCustomer } from './siigo'

export interface SiigoInvoiceDocumentType {
  id: number
  code: string
  name: string
  active: boolean
  cost_center?: boolean
  cost_center_mandatory?: boolean
  cost_center_default?: number | null
  automatic_number?: boolean
  consecutive?: number
  discount_type: 'Percentage' | 'Value'
}

export interface SiigoSeller {
  id: number
  name: string
  email: string | null
  active: boolean
}

export interface SiigoWarehouse {
  id: number
  name: string
  active: boolean
}

export type OrderSiigoInvoiceStatus = 'pending' | 'created' | 'failed' | 'uncertain'

export interface OrderSiigoInvoice {
  status: OrderSiigoInvoiceStatus
  siigoInvoiceId: string | null
  siigoInvoiceName: string | null
  total: number
  invoiceDate: string
  lastError: string | null
  createdBy: {
    name: string
    email: string
  }
  requestedAt: string
}

export interface OrderSiigoInvoiceContext {
  writeEnabled: boolean
  requiresInvoice: boolean
  eligible: boolean
  eligibilityMessage: string | null
  orderNumber: string
  orderDate: string
  orderTotal: number
  customerName: string
  customerRfc: string | null
  customer: SiigoCustomer | null
  customerReadyForInvoice: boolean
  missingCustomerFields: string[]
  invoice: OrderSiigoInvoice | null
  documentTypes: SiigoInvoiceDocumentType[]
  sellers: SiigoSeller[]
  paymentTypes: SiigoPaymentType[]
  costCenters: SiigoCostCenter[]
  warehouses: SiigoWarehouse[]
}

export interface CreateOrderSiigoInvoiceInput {
  documentTypeId: number
  invoiceNumber?: number | null
  sellerId: number
  paymentTypeId: number
  costCenterId?: number | null
  warehouseId?: number | null
  useCfdi: string
  paymentMethod: 'PPD'
  date: string
  dueDate: string
  confirmation: 'CREAR_BORRADOR_SIIGO'
}
