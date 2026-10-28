import type { ProductInput } from '#shared/schemas/product'
import type { SiigoProduct } from './siigo'

export type { ProductInput } from '#shared/schemas/product'

export interface ProductWriteDifference { field: string, expected: unknown, actual: unknown }
export interface ProductWriteReview {
  status: 'synced' | 'different' | 'unavailable' | 'local_error' | 'closed' | 'missing' | 'reverted'
  operationId: string
  productId?: string
  input: ProductInput
  isNew: boolean
  differences: ProductWriteDifference[]
  message: string
  availableAt: string
  canRetry: boolean
  canDiscard: boolean
  product?: SiigoProduct
  currentCompositionVersion?: number
  componentLabels: Record<string, string>
}
export interface ProductCatalogOption { id: number, name: string, active: boolean }
export interface ProductContext {
  accountGroups: ProductCatalogOption[]
  taxes: ProductCatalogOption[]
  priceLists: ProductCatalogOption[]
}
export interface SatEntry { code: string, name: string }
export interface SatSearchResponse {
  results: SatEntry[]
  pagination: { page: number, page_size: number, total_results: number }
  retrievedAt: string
  source: string
}
export interface ProductImage { url: string, updatedAt: string }
