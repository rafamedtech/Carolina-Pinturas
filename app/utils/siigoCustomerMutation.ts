import type { SiigoCustomer, SiigoCustomerMutationInput } from '~/types/siigo'
import { siigoCountryCodeForPerson } from '~/utils/siigoMexicoCountry'

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized || undefined
}

function personType(value: string | undefined): SiigoCustomerMutationInput['personType'] {
  const normalized = value?.toLowerCase()
  if (normalized === 'moral') return 'Moral'
  if (normalized === 'foreign') return 'Foreign'
  return 'Physical'
}

export function siigoCustomerMutationInput(
  customer: SiigoCustomer,
  overrides: { active?: boolean } = {}
): SiigoCustomerMutationInput {
  const firstContact = customer.contacts?.[0]
  const firstPhone = customer.phones?.find(phone => phone.number)?.number
    || firstContact?.phone?.number
  const normalizedPersonType = personType(customer.person_type)

  return {
    personType: normalizedPersonType,
    name: customer.name?.filter(Boolean) || [],
    rfcId: customer.rfc_id || '',
    commercialName: optionalText(customer.commercial_name),
    branchOffice: customer.branch_office,
    fiscalRegime: optionalText(customer.fiscal_regime),
    active: overrides.active ?? customer.active ?? true,
    email: optionalText(firstContact?.email),
    phone: optionalText(firstPhone),
    comments: optionalText(customer.comments),
    sellerId: customer.seller_id ?? customer.related_users?.seller_id,
    collectorId: customer.collector_id ?? customer.related_users?.collector_id,
    internal: {
      code: optionalText(customer.internal?.code),
      notes: optionalText(customer.internal?.notes),
      tags: customer.internal?.tags || []
    },
    address: {
      street: customer.address?.street || '',
      exteriorNumber: optionalText(customer.address?.exterior_number),
      interiorNumber: optionalText(customer.address?.interior_number),
      colony: optionalText(customer.address?.colony),
      locality: optionalText(customer.address?.locality),
      postalCode: optionalText(customer.address?.postal_code),
      city: {
        countryCode: siigoCountryCodeForPerson(
          normalizedPersonType,
          customer.address?.city?.country_code
        ),
        stateCode: customer.address?.city?.state_code || '',
        cityCode: customer.address?.city?.city_code || ''
      }
    }
  }
}

export function missingSiigoCustomerFields(input: SiigoCustomerMutationInput) {
  const missing: string[] = []
  if (!input.name.length || input.name.some(part => !part.trim())) missing.push('nombre')
  if (!input.rfcId.trim()) missing.push('RFC')
  if (!input.address.street.trim()) missing.push('calle')
  if (!input.address.city.countryCode.trim()) missing.push('código de país')
  if (!input.address.city.stateCode.trim()) missing.push('código de estado')
  if (!input.address.city.cityCode.trim()) missing.push('código de ciudad')
  return missing
}
