export type UserRole = 'admin' | 'mostrador' | 'vendedor' | 'repartidor' | 'igualaciones'

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  repartidorId: string | null
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
  description?: string
  unit?: string | {
    code?: string
    name?: string
  }
  key?: {
    code?: string
    name?: string
  }
  tax_included?: boolean
  account_group?: {
    id?: string | number
    name?: string
  }
  additional_fields?: {
    barcode?: string
    brand?: string
  }
  taxes?: Array<{
    id?: string | number
    name?: string
    percentage?: number
    type?: string
  }>
  warehouses?: Array<{
    id?: string | number
    name?: string
    quantity?: number
  }>
  components?: Array<{
    id?: string | number
    name?: string
    quantity?: number
  }>
  metadata?: {
    created?: string
    last_updated?: string | null
  }
  price?: number | string
  prices?: Array<{
    currency_code?: string
    price_list?: Array<{
      position?: number
      name?: string
      value?: number | string
    }>
  }>
}

export interface SiigoCustomer {
  id: string
  name: string[]
  commercial_name?: string
  branch_office?: number
  person_type?: string
  type?: string
  identification?: string
  rfc_id?: string
  fiscal_regime?: string
  active?: boolean
  comments?: string
  seller_id?: number
  collector_id?: number
  related_users?: {
    seller_id?: number
    collector_id?: number
  }
  address?: {
    street?: string
    interior_number?: string
    exterior_number?: string
    colony?: string
    locality?: string
    city?: {
      country_code?: string
      country_name?: string
      state_code?: string
      state_name?: string
      city_code?: string
      city_name?: string
    }
    postal_code?: string
  }
  phones?: Array<{
    indicative?: string
    number?: string
    extension?: string
  }>
  contacts?: Array<{
    first_name?: string
    last_name?: string
    email?: string
    phone?: {
      indicative?: string
      number?: string
      extension?: string
    }
  }>
  metadata?: {
    created?: string
    last_updated?: string | null
  }
  internal?: {
    code?: string | null
    notes?: string | null
    tags: string[]
    roles?: {
      customer: boolean
      supplier: boolean
    }
    requires_invoice?: boolean
    sync_status: string
    sync_version: number
    synced_at: string
  }
}

export interface SiigoCustomerSyncResult {
  received: number
  synchronized: number
  synchronized_at: string
}

export interface SiigoCustomerMutationInput {
  personType: 'Physical' | 'Moral' | 'Foreign'
  name: string[]
  rfcId: string
  commercialName?: string
  branchOffice?: number
  fiscalRegime?: string
  active?: boolean
  email?: string
  phone?: string
  comments?: string
  sellerId?: number
  collectorId?: number
  internal?: {
    code?: string
    notes?: string
    tags: string[]
    requiresInvoice?: boolean
  }
  address: {
    street: string
    exteriorNumber?: string
    interiorNumber?: string
    colony?: string
    locality?: string
    postalCode?: string
    city: {
      countryCode: string
      stateCode: string
      cityCode: string
    }
  }
}

export interface SiigoInvoice {
  id: string
  name: string
  date: string
  document?: {
    id?: number
  }
  number?: number
  customer?: {
    id?: string
    identification?: string
    rfc_id?: string
    name?: string
  }
  total?: number
  balance?: number
  status?: string
  stamp?: {
    status?: string
  }
}

export interface SiigoInvoiceDetail extends SiigoInvoice {
  document?: {
    id?: number
  }
  number?: number
  customer?: {
    id?: string
    identification?: string
    rfc_id?: string
    name?: string
    branch_office?: number
  }
  balance?: number
  seller?: number
  use?: {
    code?: string
    name?: string
  }
  observations?: string
  items?: Array<{
    id?: string
    code?: string
    description?: string
    quantity?: number
    price?: number
    total?: number
    discount?: {
      percentage?: number
      value?: number
    }
  }>
  payment?: {
    method?: string
    cfdi?: {
      code?: string
      name?: string
    }
    paid?: boolean
    conditions?: Array<{
      id?: number
      name?: string
      value?: number
      due_date?: string
    }>
  }
  metadata?: {
    created?: string
    last_updated?: string | null
  }
}

export interface SiigoListResponse<T> {
  results: T[]
  pagination?: {
    total_results?: number
    page?: number
    page_size?: number
  }
}
