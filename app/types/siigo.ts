export type UserRole = 'admin' | 'mostrador' | 'vendedor'

export interface AppUser {
  name: string
  email: string
  role: UserRole
}

export interface SiigoProduct {
  id: string
  code: string
  name: string
  type?: string
  active?: boolean
  stock_control?: boolean
  available_quantity?: number
  reference?: string
  price?: number | string
  prices?: Array<{
    currency_code?: string
    price_list?: Array<{
      position?: number
      value?: number | string
    }>
  }>
}

export interface SiigoCustomer {
  id: string
  name: string[]
  person_type?: string
  type?: string
  rfc_id?: string
  fiscal_regime?: string
  active?: boolean
  address?: {
    street?: string
    interior_number?: string
    exterior_number?: string
    colony?: string
    locality?: string
    city?: {
      city_name?: string
      state_name?: string
    }
    postal_code?: string
  }
  phones?: Array<{
    number?: string
  }>
  contacts?: Array<{
    first_name?: string
    last_name?: string
    email?: string
    phone?: {
      number?: string
    }
  }>
}

export interface SiigoInvoice {
  id: string
  name: string
  date: string
  customer?: {
    identification?: string
    name?: string
  }
  total?: number
  status?: string
}

export interface SiigoListResponse<T> {
  results: T[]
  pagination?: {
    total_results?: number
    page?: number
    page_size?: number
  }
}
