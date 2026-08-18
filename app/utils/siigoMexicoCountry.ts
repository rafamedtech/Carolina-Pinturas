import type { SiigoCustomerMutationInput } from '~/types/siigo'

// El catálogo oficial Paises-Estados-Ciudades.xlsx de Siigo México usa códigos
// ISO con esta capitalización (`Mx`, `Us`, etc.). La API los valida de forma
// sensible a mayúsculas aunque algunos ejemplos del blueprint muestran `MX`.
export const SIIGO_MEXICO_COUNTRY_CODE = 'Mx'

export function siigoCountryCodeForPerson(
  personType: SiigoCustomerMutationInput['personType'],
  countryCode: string | undefined
) {
  if (personType !== 'Foreign') return SIIGO_MEXICO_COUNTRY_CODE
  const normalized = countryCode?.trim()
  return normalized
    ? normalized.slice(0, 1).toUpperCase() + normalized.slice(1).toLowerCase()
    : ''
}

function padNumericLocationCode(value: string, length: number) {
  const normalized = value.trim()
  return /^\d+$/.test(normalized) ? normalized.padStart(length, '0') : normalized
}

export function siigoMexicoStateCodeForApi(value: string) {
  return padNumericLocationCode(value, 2)
}

export function siigoMexicoCityCodeForApi(value: string) {
  return padNumericLocationCode(value, 3)
}
