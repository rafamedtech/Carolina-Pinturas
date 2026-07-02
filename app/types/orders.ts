export interface Repartidor {
  id: string
  nombre: string
  telefono: string | null
  activo: boolean
  deliveredCount: number
}

export interface RepartidorDelivery {
  id: string
  folio: number
  number: string
  customerName: string
  orderDate: string
  total: number
}

export interface RepartidorDetail {
  id: string
  nombre: string
  telefono: string | null
  activo: boolean
  deliveredOrders: RepartidorDelivery[]
}

export interface OrderStatus {
  key: string
  label: string
  color: string
  sortOrder: number
  isTerminal: boolean
}

export interface SalesOrderListItem {
  id: string
  folio: number
  number: string
  status: OrderStatus
  customer: {
    id: string
    name: string
    rfc: string | null
  }
  orderDate: string
  promisedDate: string | null
  total: number
  itemCount: number
  partidas?: { code: string, name: string, quantity: number, observations: string | null, isIgualacion: boolean }[]
  createdAt: string
  updatedAt: string
}

export interface SalesOrderListResponse {
  results: SalesOrderListItem[]
  pagination: {
    page: number
    pageSize: number
    totalResults: number
    totalPages: number
  }
}

export interface SalesOrderItem {
  id: string
  position: number
  productId: string
  code: string
  name: string
  description: string | null
  reference: string | null
  unit: {
    code: string | null
    name: string | null
  }
  quantity: number
  unitPrice: number
  discountPercentage: number
  discountAmount: number
  subtotal: number
  taxAmount: number
  total: number
  observations: string | null
}

export interface SalesOrderStatusHistoryItem {
  id: string
  fromStatus: Pick<OrderStatus, 'key' | 'label'> | null
  toStatus: Pick<OrderStatus, 'key' | 'label'>
  note: string | null
  changedBy: {
    name: string
    email: string
    role: string
  }
  changedAt: string
}

export interface SalesOrderDetail extends SalesOrderListItem {
  observations: string | null
  remision: string | null
  currencyCode: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  siigoReference: string | null
  registeredInSiigoAt: string | null
  version: number
  vendedor: {
    name: string
    email: string
  }
  repartidor: {
    id: string
    name: string
    telefono: string | null
  }
  createdBy: {
    name: string
    email: string
    role: string
  }
  items: SalesOrderItem[]
  statusHistory: SalesOrderStatusHistoryItem[]
}
