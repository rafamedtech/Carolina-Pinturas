import { createError } from 'h3'
import type { SiigoCustomer } from '~/types/siigo'
import type { CreateCustomerInput } from './customer-validation'

// Cuerpo de POST /v1/customers en Siigo México. Solo se envían propiedades
// documentadas y con valor; `type` (Customer) y `active` (true) se omiten
// porque son los valores por defecto del contrato.
export interface SiigoCustomerCreateRequest {
  person_type: 'Physical' | 'Moral' | 'Foreign'
  rfc_id: string
  // Physical envía [nombres, apellidos]; Moral/Foreign un solo string.
  name: string[] | string
  fiscal_regime?: string
  address: {
    address: string
    exterior_number?: string
    interior_number?: string
    colony?: string
    city: {
      country_code: string
      state_code: string
      city_code: string
    }
    postal_code?: string
  }
  // El blueprint de Siigo México declara ambos como arreglo a nivel de
  // schema (CustomerIn); enviar un objeto suelto produce
  // "Invalid data type: contacts" en producción (confirmado 2026-07-06).
  phones?: Array<{
    number: string
  }>
  contacts: Array<{
    first_name: string
    last_name?: string
    email?: string
  }>
  comments?: string
}

// Respuesta cruda de Siigo: campos sin garantías; `name` puede llegar como
// string o string[] según el tipo de persona.
export interface SiigoCustomerApiResponse {
  id?: unknown
  name?: unknown
  rfc_id?: unknown
  commercial_name?: unknown
  [key: string]: unknown
}

export function buildSiigoCustomerPayload(input: CreateCustomerInput): SiigoCustomerCreateRequest {
  const payload: SiigoCustomerCreateRequest = {
    person_type: input.personType,
    rfc_id: input.rfcId,
    name: input.personType === 'Physical' ? input.name : input.name[0]!,
    address: {
      address: input.address.street,
      city: {
        country_code: input.address.city.countryCode,
        state_code: input.address.city.stateCode,
        city_code: input.address.city.cityCode
      }
    },
    contacts: [{
      // Siigo exige un contacto con first_name; se deriva del propio cliente.
      first_name: input.name[0]!.slice(0, 50)
    }]
  }

  if (input.fiscalRegime) payload.fiscal_regime = input.fiscalRegime
  if (input.address.exteriorNumber) payload.address.exterior_number = input.address.exteriorNumber
  if (input.address.interiorNumber) payload.address.interior_number = input.address.interiorNumber
  if (input.address.colony) payload.address.colony = input.address.colony
  if (input.address.postalCode) payload.address.postal_code = input.address.postalCode
  if (input.phone) payload.phones = [{ number: input.phone }]
  if (input.name[1]) payload.contacts[0]!.last_name = input.name[1].slice(0, 50)
  if (input.email) payload.contacts[0]!.email = input.email
  if (input.comments) payload.comments = input.comments

  return payload
}

function normalizeName(raw: SiigoCustomerApiResponse): string[] {
  const candidates = Array.isArray(raw.name) ? raw.name : [raw.name]
  const name = candidates
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .map(part => part.trim())

  if (name.length) return name

  for (const fallback of [raw.commercial_name, raw.rfc_id]) {
    if (typeof fallback === 'string' && fallback.trim()) return [fallback.trim()]
  }

  return []
}

// Garantiza que el cliente que recibe el frontend tenga id y nombre utilizables
// aunque Siigo devuelva name como string, string[] o vacío.
export function normalizeSiigoCustomer(raw: SiigoCustomerApiResponse): SiigoCustomer {
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : null
  const name = normalizeName(raw)

  if (!id || !name.length) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Siigo devolvió una respuesta inesperada al crear el cliente.',
      data: raw
    })
  }

  return {
    ...(raw as Partial<SiigoCustomer>),
    id,
    name
  }
}
