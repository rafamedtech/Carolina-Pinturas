import type { SiigoCustomer } from '~/types/siigo'

export function siigoCustomerName(customer: SiigoCustomer | null | undefined) {
  if (!customer) return null

  return customer.name?.filter(part => typeof part === 'string' && part.trim()).join(' ')
    || customer.commercial_name?.trim()
    || customer.rfc_id
    || customer.identification
    || null
}

export function siigoCustomerPhone(customer: SiigoCustomer | null | undefined) {
  if (!customer) return null

  return customer.phones?.map(item => item.number).filter(Boolean).join(', ')
    || customer.contacts?.[0]?.phone?.number
    || null
}

export function siigoCustomerAddress(customer: SiigoCustomer | null | undefined) {
  const value = customer?.address
  if (!value) return null

  return [
    [value.street, value.exterior_number, value.interior_number].filter(Boolean).join(' '),
    value.colony,
    value.locality,
    value.city?.city_name,
    value.city?.state_name,
    value.postal_code
  ].filter(Boolean).join(', ') || null
}
