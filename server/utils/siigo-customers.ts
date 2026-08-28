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
    street: string
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

const SIIGO_UPDATE_STREET_MAX_LENGTH = 20

export function siigoStreetForPublicApi(street: string) {
  const normalized = street
    .trim()
    .replace(/\bBOULEVARD\s*\(BLVD\.?\)/giu, 'BLVD')
    .replace(/\bBOULEVARD\b/giu, 'BLVD')
    .replace(/\bAVENIDA\b/giu, 'AV')
    .replace(/\bCARRETERA\b/giu, 'CARR')
    .replace(/\bCALZADA\b/giu, 'CALZ')
    .replace(/\s+/g, ' ')

  if (normalized.length <= SIIGO_UPDATE_STREET_MAX_LENGTH) return normalized

  const words = normalized.split(' ').filter(word => !/^\p{L}\.$/u.test(word))
  const compact = words.join(' ')
  if (compact.length <= SIIGO_UPDATE_STREET_MAX_LENGTH) return compact

  if (words.length > 2) {
    const abbreviatedMiddle = [
      words[0]!,
      ...words.slice(1, -1).map(word => word.length > 4 ? `${word.slice(0, 3)}.` : word),
      words.at(-1)!
    ].join(' ')
    if (abbreviatedMiddle.length <= SIIGO_UPDATE_STREET_MAX_LENGTH) {
      return abbreviatedMiddle
    }
  }

  // Conserva el tipo de vía y el apellido/final del nombre cuando no caben
  // todas las palabras. Es más informativo que cortar ciegamente a 20.
  if (words.length > 1) {
    const first = words[0]!
    const tail: string[] = []
    for (let index = words.length - 1; index > 0; index--) {
      const candidate = [first, words[index], ...tail].join(' ')
      if (candidate.length > SIIGO_UPDATE_STREET_MAX_LENGTH) break
      tail.unshift(words[index]!)
    }
    if (tail.length) return [first, ...tail].join(' ')
  }

  return compact.slice(0, SIIGO_UPDATE_STREET_MAX_LENGTH).trimEnd()
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
  const createPayload = buildSiigoCustomerPayload(input)
  const payload: SiigoCustomerUpdateRequest = {
    ...createPayload,
    address: {
      ...createPayload.address,
      street: siigoStreetForPublicApi(input.address.street)
    }
  }
  const currentCountryCode = currentCustomer.address?.city?.country_code?.trim()
  const currentPersonType = currentCustomer.person_type?.trim().toLowerCase()
  const currentType = currentCustomer.type?.trim().toLowerCase()

  // Regresión confirmada el 2026-08-27: PUT necesita `street` para reflejar la
  // calle en Siigo Nube, pero ese campo legado acepta solo 20 caracteres. Se
  // conserva la dirección completa en `address` y se envía una versión legible
  // y acotada en `street`; PostgreSQL mantiene siempre el valor completo.
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

function owns(value: Record<string, unknown> | null, key: string) {
  return value !== null && Object.prototype.hasOwnProperty.call(value, key)
}

// Convierte respuesta potencialmente incompleta de POST/PUT al mismo formato
// canónico que PostgreSQL y frontend consumen. El payload enviado completa los
// campos que Siigo aceptó pero omitió en su respuesta.
export function customerFromSiigoWrite(
  external: SiigoCustomer,
  payload: SiigoCustomerCreateRequest | SiigoCustomerUpdateRequest
): SiigoCustomer {
  return {
    ...external,
    type: payload.type || external.type || 'Customer',
    person_type: payload.person_type,
    rfc_id: payload.rfc_id,
    name: Array.isArray(payload.name) ? payload.name : [payload.name],
    commercial_name: payload.commercial_name,
    branch_office: payload.branch_office,
    fiscal_regime: payload.fiscal_regime,
    active: payload.active ?? external.active ?? true,
    comments: payload.comments,
    seller_id: payload.seller_id,
    collector_id: payload.collector_id,
    address: {
      street: payload.address.address,
      interior_number: payload.address.interior_number,
      exterior_number: payload.address.exterior_number,
      colony: payload.address.colony,
      locality: payload.address.locality,
      postal_code: payload.address.postal_code,
      city: {
        ...external.address?.city,
        ...payload.address.city
      }
    },
    phones: payload.phones === undefined ? external.phones : payload.phones,
    contacts: payload.contacts === undefined ? external.contacts : payload.contacts
  }
}

// Siigo es fuente de verdad para cada clave realmente devuelta. Su API México
// omite campos válidos (calle fue observada el 2026-08-27); ausencia no equivale
// a borrado. Para una clave omitida se conserva el último valor de PostgreSQL.
export function reconcileSiigoCustomer(
  external: SiigoCustomer,
  local: SiigoCustomer,
  raw: SiigoCustomerApiResponse
): SiigoCustomer {
  const rawCustomer = record(raw)
  const addressValue = <K extends keyof NonNullable<SiigoCustomer['address']>>(key: K) => (
    external.address?.[key] || local.address?.[key]
  )
  const cityValue = <K extends keyof NonNullable<NonNullable<SiigoCustomer['address']>['city']>>(key: K) => (
    external.address?.city?.[key] || local.address?.city?.[key]
  )

  return {
    ...local,
    ...external,
    fiscal_regime: owns(rawCustomer, 'fiscal_regime')
      ? external.fiscal_regime
      : local.fiscal_regime,
    seller_id: owns(rawCustomer, 'seller_id') || owns(record(raw.related_users), 'seller_id')
      ? external.seller_id
      : local.seller_id,
    collector_id: owns(rawCustomer, 'collector_id') || owns(record(raw.related_users), 'collector_id')
      ? external.collector_id
      : local.collector_id,
    address: {
      street: external.address?.street || local.address?.street,
      interior_number: addressValue('interior_number'),
      exterior_number: addressValue('exterior_number'),
      colony: addressValue('colony'),
      locality: addressValue('locality'),
      postal_code: addressValue('postal_code'),
      city: {
        country_code: cityValue('country_code'),
        country_name: cityValue('country_name'),
        state_code: cityValue('state_code'),
        state_name: cityValue('state_name'),
        city_code: cityValue('city_code'),
        city_name: cityValue('city_name')
      }
    },
    phones: owns(rawCustomer, 'phones') ? external.phones : local.phones,
    contacts: owns(rawCustomer, 'contacts') ? external.contacts : local.contacts,
    internal: local.internal
  }
}

export function siigoCustomerPersistenceState(customer: SiigoCustomer) {
  return {
    name: customer.name,
    commercial_name: customer.commercial_name ?? null,
    branch_office: customer.branch_office ?? null,
    person_type: customer.person_type ?? null,
    type: customer.type ?? null,
    identification: customer.identification ?? null,
    rfc_id: customer.rfc_id ?? null,
    fiscal_regime: customer.fiscal_regime ?? null,
    active: customer.active ?? null,
    comments: customer.comments ?? null,
    seller_id: customer.seller_id ?? null,
    collector_id: customer.collector_id ?? null,
    address: {
      street: customer.address?.street ?? null,
      interior_number: customer.address?.interior_number ?? null,
      exterior_number: customer.address?.exterior_number ?? null,
      colony: customer.address?.colony ?? null,
      locality: customer.address?.locality ?? null,
      postal_code: customer.address?.postal_code ?? null,
      city: {
        country_code: customer.address?.city?.country_code ?? null,
        country_name: customer.address?.city?.country_name ?? null,
        state_code: customer.address?.city?.state_code ?? null,
        state_name: customer.address?.city?.state_name ?? null,
        city_code: customer.address?.city?.city_code ?? null,
        city_name: customer.address?.city?.city_name ?? null
      }
    },
    phones: (customer.phones || []).map(phone => ({
      indicative: phone.indicative ?? null,
      number: phone.number ?? null,
      extension: phone.extension ?? null
    })),
    contacts: (customer.contacts || []).map(contact => ({
      first_name: contact.first_name ?? null,
      last_name: contact.last_name ?? null,
      email: contact.email ?? null,
      phone: {
        indicative: contact.phone?.indicative ?? null,
        number: contact.phone?.number ?? null,
        extension: contact.phone?.extension ?? null
      }
    })),
    metadata: {
      created: customer.metadata?.created,
      last_updated: customer.metadata?.last_updated ?? null
    }
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
