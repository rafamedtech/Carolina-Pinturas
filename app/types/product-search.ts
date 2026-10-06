export interface SearchableProduct {
  id: string
  name: string
  code?: string
  reference?: string
  additional_fields?: { barcode?: string }
}
