import { createError } from 'h3'
import type { SiigoCustomer, SiigoListResponse } from '~/types/siigo'
import {
  siigoCountryCodeForPerson,
  siigoMexicoCityCodeForApi,
  siigoMexicoStateCodeForApi
} from '~/utils/siigoMexicoCountry'
import type { CreateCustomerInput } from './customer-validation'

// Cuerpo de POST /v1/customers en Siigo México. Solo se envían propiedades
// documentadas y con valor; `type` (Customer) y `active` (true) se omiten
// porque son los valores por defecto del contrato.
export interface SiigoCustomerCreateRequest {
  type?: 'Customer' | 'Supplier' | 'Other'
  person_type: 'Physical' | 'Moral' | 'Foreign'
  rfc_id: string
  // Physical envía [nombres, apellidos]; Moral/Foreign un solo string.
  name: string[] | string
  commercial_name?: string
  branch_office?: number
  fiscal_regime?: string
  active?: boolean
  address: {
    address: string
    exterior_number?: string
    interior_number?: string
    colony?: string
    locality?: string
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
  seller_id?: number
  collector_id?: number
}

export type SiigoCustomerUpdateRequest = Omit<SiigoCustomerCreateRequest, 'contacts'> & {
  address: SiigoCustomerCreateRequest['address'] & {
    street?: string
  }
  contacts?: SiigoCustomerCreateRequest['contacts']
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
        // Regresión observada el 2026-08-18: el XLSX oficial usa `Mx`; enviar
        // `MX` provoca invalid_country_code aunque el blueprint muestre esa
        // variante. El servidor normaliza la capitalización del catálogo.
        country_code: siigoCountryCodeForPerson(input.personType, input.address.city.countryCode),
        // El tenant devuelve y acepta México con estado de 2 dígitos y ciudad
        // de 3 (`Mx|02|004` para Tijuana), aunque el XLSX los muestre como 2|4.
        state_code: input.personType === 'Foreign'
          ? input.address.city.stateCode.trim()
          : siigoMexicoStateCodeForApi(input.address.city.stateCode),
        city_code: input.personType === 'Foreign'
          ? input.address.city.cityCode.trim()
          : siigoMexicoCityCodeForApi(input.address.city.cityCode)
      }
    },
    contacts: [{
      // Siigo exige un contacto con first_name; se deriva del propio cliente.
      first_name: input.name[0]!.slice(0, 50)
    }]
  }

  if (input.commercialName) payload.commercial_name = input.commercialName
  if (input.branchOffice != null) payload.branch_office = input.branchOffice
  if (input.fiscalRegime) payload.fiscal_regime = input.fiscalRegime
  if (input.active != null) payload.active = input.active
  if (input.address.exteriorNumber) payload.address.exterior_number = input.address.exteriorNumber
  if (input.address.interiorNumber) payload.address.interior_number = input.address.interiorNumber
  if (input.address.colony) payload.address.colony = input.address.colony
  if (input.address.locality) payload.address.locality = input.address.locality
  if (input.address.postalCode) payload.address.postal_code = input.address.postalCode
  if (input.phone) payload.phones = [{ number: input.phone }]
  if (input.name[1]) payload.contacts[0]!.last_name = input.name[1].slice(0, 50)
  if (input.email) payload.contacts[0]!.email = input.email
  if (input.comments) payload.comments = input.comments
  if (input.sellerId != null) payload.seller_id = input.sellerId
  if (input.collectorId != null) payload.collector_id = input.collectorId

  return payload
}

export function buildSiigoCustomerUpdatePayload(
  input: CreateCustomerInput,
  currentCustomer: SiigoCustomer
): SiigoCustomerUpdateRequest {
  const payload: SiigoCustomerUpdateRequest = buildSiigoCustomerPayload(input)
  const currentCountryCode = currentCustomer.address?.city?.country_code?.trim()
  const currentPersonType = currentCustomer.person_type?.trim().toLowerCase()
  const currentType = currentCustomer.type?.trim().toLowerCase()

  // Regresión observada el 2026-08-18: el PUT acepta `address.address` pero el
  // tenant no actualiza Calle con esa propiedad. El schema AddressIn también
  // documenta `street`; se envían ambas variantes solo en actualización.
  payload.address.street = input.address.street

  // Para Foreign se conserva el país vigente si existe. Physical y Moral
  // siempre reciben el `Mx` canónico generado por buildSiigoCustomerPayload.
  if (payload.person_type === 'Foreign' && currentCountryCode) {
    payload.address.city.country_code = currentCountryCode
  }

  // El POST necesita un contacto derivado del nombre, pero el PUT del tenant
  // exige email cuando `contacts` está presente. No se envía el bloque cuando
  // el formulario no incluye correo, evitando modificar contactos históricos.
  if (!input.email) delete payload.contacts
  if (currentPersonType === 'physical') payload.person_type = 'Physical'
  if (currentPersonType === 'moral') payload.person_type = 'Moral'
  if (currentPersonType === 'foreign') payload.person_type = 'Foreign'
  if (currentType === 'customer') payload.type = 'Customer'
  if (currentType === 'supplier') payload.type = 'Supplier'
  if (currentType === 'other') payload.type = 'Other'

  return payload
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function collection(value: unknown) {
  if (Array.isArray(value)) return value
  return record(value) ? [value] : []
}

function normalizeFiscalRegime(value: unknown) {
  const direct = text(value)
  if (direct) return direct

  for (const candidate of collection(value)) {
    const code = text(record(candidate)?.code)
    if (code) return code
  }

  return text(record(value)?.code)
}

function normalizeAddress(value: unknown): SiigoCustomer['address'] | undefined {
  const address = record(value)
  if (!address) return undefined
  const city = record(address.city)

  return {
    street: text(address.street) || text(address.address),
    interior_number: text(address.interior_number),
    exterior_number: text(address.exterior_number),
    colony: text(address.colony),
    locality: text(address.locality),
    city: city
      ? {
          country_code: text(city.country_code),
          country_name: text(city.country_name),
          state_code: text(city.state_code),
          state_name: text(city.state_name),
          city_code: text(city.city_code),
          city_name: text(city.city_name)
        }
      : undefined,
    postal_code: text(address.postal_code)
  }
}

function normalizePhones(value: unknown): NonNullable<SiigoCustomer['phones']> {
  return collection(value).flatMap((candidate) => {
    const phone = record(candidate)
    if (!phone) return []

    return [{
      indicative: text(phone.indicative),
      number: text(phone.number),
      extension: text(phone.extension)
    }]
  })
}

function normalizeContacts(value: unknown): NonNullable<SiigoCustomer['contacts']> {
  return collection(value).flatMap((candidate) => {
    const contact = record(candidate)
    if (!contact) return []
    const phone = record(contact.phone)

    return [{
      first_name: text(contact.first_name),
      last_name: text(contact.last_name),
      email: text(contact.email),
      phone: phone
        ? {
            indicative: text(phone.indicative),
            number: text(phone.number),
            extension: text(phone.extension)
          }
        : undefined
    }]
  })
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

  const relatedUsers = record(raw.related_users)
  const sellerId = typeof raw.seller_id === 'number'
    ? raw.seller_id
    : typeof relatedUsers?.seller_id === 'number' ? relatedUsers.seller_id : undefined
  const collectorId = typeof raw.collector_id === 'number'
    ? raw.collector_id
    : typeof relatedUsers?.collector_id === 'number' ? relatedUsers.collector_id : undefined

  return {
    ...(raw as Partial<SiigoCustomer>),
    id,
    name,
    fiscal_regime: normalizeFiscalRegime(raw.fiscal_regime),
    address: normalizeAddress(raw.address),
    phones: normalizePhones(raw.phones),
    contacts: normalizeContacts(raw.contacts),
    seller_id: sellerId,
    collector_id: collectorId
  }
}

export function normalizeSiigoCustomerList(
  response: SiigoListResponse<SiigoCustomerApiResponse>
): SiigoListResponse<SiigoCustomer> {
  return {
    ...response,
    results: response.results.map(normalizeSiigoCustomer)
  }
}
