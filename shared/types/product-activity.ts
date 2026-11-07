import type { InventoryPage } from './inventory'

export const productActivitySections = ['sales', 'purchases', 'receipts', 'movements', 'reservations', 'counts', 'expenses'] as const
export type ProductActivitySection = typeof productActivitySections[number]

export interface ProductActivityRow {
  id: string
  date: string
  reference: string
  href?: string
  context: string
  detail?: string
  status?: string
  quantity?: string
  balance?: string
  amount?: { value: string, currency: string }
}

export type ProductActivityPage = InventoryPage<ProductActivityRow>
