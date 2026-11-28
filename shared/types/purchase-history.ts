export interface PurchaseHistoryRow {
  id: string
  orderId: string
  folio: number
  date: string
  providerId: string
  providerName: string
  productId: string
  code: string
  name: string
  unit: string | null
  quantity: string
  received: string
  pending: string
  unitCost: string
  total: string
  currencyCode: string
  /** Partida de la compra confirmada más reciente del producto, sin importar filtros. */
  isLatest: boolean
}

export interface PurchaseHistoryLatest {
  orderId: string
  folio: number
  date: string
  providerName: string
  unitCost: string
  currencyCode: string
}

export interface PurchaseHistoryOption {
  value: string
  label: string
  code?: string
}

export interface PurchaseHistoryPage {
  results: PurchaseHistoryRow[]
  /** Última compra del producto filtrado; null sin filtro de producto o sin compras. */
  latest: PurchaseHistoryLatest | null
  options: { products: PurchaseHistoryOption[], providers: PurchaseHistoryOption[] }
  pagination: { page: number, pageSize: number, totalResults: number, totalPages: number }
}
