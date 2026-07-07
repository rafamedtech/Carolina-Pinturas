import type { SiigoCustomer } from '~/types/siigo'

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
