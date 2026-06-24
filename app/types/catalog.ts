export interface CatalogPrice {
  code: string
  name: string
  price: number | null
  currency: string
  reference?: string
  type?: string
  availableQuantity?: number
  stockControl?: boolean
}

export interface PriceCatalogResponse {
  updatedAt: string
  products: CatalogPrice[]
}
