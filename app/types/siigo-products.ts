export type { ProductInput } from '#shared/schemas/product'
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
