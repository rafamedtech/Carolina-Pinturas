import { describe, expect, it } from 'vitest'
import type { CreateCustomerInput } from '../../server/utils/customer-validation'
import { buildSiigoCustomerPayload, normalizeSiigoCustomer } from '../../server/utils/siigo-customers'

function physicalInput(overrides: Partial<CreateCustomerInput> = {}): CreateCustomerInput {
  return {
    personType: 'Physical',
    name: ['María', 'López'],
    rfcId: 'LOMA850101AB1',
    fiscalRegime: '616',
    email: 'maria@example.com',
    phone: '5512345678',
    comments: 'Cliente de mostrador',
    address: {
      street: 'Av. Reforma',
      exteriorNumber: '123',
      interiorNumber: '4B',
      colony: 'Centro',
      postalCode: '06000',
      city: { countryCode: 'MX', stateCode: '9', cityCode: '1' }
    },
    ...overrides
  }
}

function captureError(run: () => unknown): unknown {
  try {
    run()
  } catch (error) {
    return error
  }
  throw new Error('Se esperaba una excepción y no ocurrió.')
}

function walkValues(value: unknown, visit: (value: unknown) => void) {
  visit(value)
  if (Array.isArray(value)) {
    value.forEach(item => walkValues(item, visit))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(item => walkValues(item, visit))
  }
}

describe('buildSiigoCustomerPayload', () => {
  it('arma el payload completo de persona física según el contrato de Siigo México', () => {
    expect(buildSiigoCustomerPayload(physicalInput())).toEqual({
      person_type: 'Physical',
      rfc_id: 'LOMA850101AB1',
      name: ['María', 'López'],
      fiscal_regime: '616',
      address: {
        address: 'Av. Reforma',
        exterior_number: '123',
        interior_number: '4B',
        colony: 'Centro',
        postal_code: '06000',
        city: { country_code: 'MX', state_code: '9', city_code: '1' }
      },
      phones: [{ number: '5512345678' }],
      contacts: [{ first_name: 'María', last_name: 'López', email: 'maria@example.com' }],
      comments: 'Cliente de mostrador'
    })
  })

  it('arma el payload mínimo de persona moral sin propiedades vacías ni extra', () => {
    const payload = buildSiigoCustomerPayload({
      personType: 'Moral',
      name: ['Pinturas Industriales SA de CV'],
      rfcId: 'PIN900101AB1',
      address: {
        street: 'Calle 5',
        city: { countryCode: 'MX', stateCode: '9', cityCode: '1' }
      }
    })

    expect(payload).toEqual({
      person_type: 'Moral',
      rfc_id: 'PIN900101AB1',
      name: 'Pinturas Industriales SA de CV',
      address: {
        address: 'Calle 5',
        city: { country_code: 'MX', state_code: '9', city_code: '1' }
      },
      contacts: [{ first_name: 'Pinturas Industriales SA de CV' }]
    })
    expect(payload).not.toHaveProperty('phones')
    expect(payload).not.toHaveProperty('fiscal_regime')
    expect(payload).not.toHaveProperty('comments')
    expect(payload).not.toHaveProperty('type')
    expect(payload).not.toHaveProperty('active')
    expect(payload.address).not.toHaveProperty('street')

    walkValues(payload, (value) => {
      expect(value).not.toBeUndefined()
      expect(value).not.toBeNull()
      expect(value).not.toBe('')
    })
  })

  it('arma el payload de extranjero con un solo campo de nombre', () => {
    const payload = buildSiigoCustomerPayload({
      personType: 'Foreign',
      name: ['Acme Paints LLC'],
      rfcId: 'XEXX010101000',
      address: {
        street: 'Main St 100',
        city: { countryCode: 'US', stateCode: '5', cityCode: '2' }
      }
    })

    expect(payload.person_type).toBe('Foreign')
    expect(payload.name).toBe('Acme Paints LLC')
    expect(payload.contacts).toEqual([{ first_name: 'Acme Paints LLC' }])
  })

  it('recorta el contacto derivado a 50 caracteres', () => {
    const longName = 'A'.repeat(80)
    const payload = buildSiigoCustomerPayload(physicalInput({ name: [longName, longName] }))

    expect(payload.contacts[0]!.first_name).toHaveLength(50)
    expect(payload.contacts[0]!.last_name).toHaveLength(50)
  })
})

describe('buildSiigoCustomerPayload — forma de phones/contacts', () => {
  // Regresión: Siigo México rechazó en producción un `contacts` enviado como
  // objeto suelto con "Invalid data type: contacts". El schema CustomerIn del
  // blueprint oficial los declara como array[Phone]/array[Contact].
  it('siempre envía phones y contacts como arreglo, nunca como objeto', () => {
    const withPhone = buildSiigoCustomerPayload(physicalInput())
    expect(Array.isArray(withPhone.phones)).toBe(true)
    expect(Array.isArray(withPhone.contacts)).toBe(true)

    const withoutPhone = buildSiigoCustomerPayload(physicalInput({ phone: undefined }))
    expect(withoutPhone.phones).toBeUndefined()
    expect(Array.isArray(withoutPhone.contacts)).toBe(true)
  })
})

describe('normalizeSiigoCustomer', () => {
  const id = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'

  it('conserva name cuando llega como arreglo', () => {
    const customer = normalizeSiigoCustomer({ id, name: ['María', 'López'], rfc_id: 'LOMA850101AB1' })
    expect(customer.id).toBe(id)
    expect(customer.name).toEqual(['María', 'López'])
  })

  it('convierte name string a arreglo', () => {
    expect(normalizeSiigoCustomer({ id, name: 'Pinturas SA' }).name).toEqual(['Pinturas SA'])
  })

  it('filtra elementos vacíos y usa rfc_id como respaldo', () => {
    expect(normalizeSiigoCustomer({ id, name: ['', '  '], rfc_id: 'PIN900101AB1' }).name)
      .toEqual(['PIN900101AB1'])
  })

  it('prefiere commercial_name sobre rfc_id como respaldo', () => {
    const customer = normalizeSiigoCustomer({
      id,
      name: null,
      commercial_name: 'Pinturas Centro',
      rfc_id: 'PIN900101AB1'
    })
    expect(customer.name).toEqual(['Pinturas Centro'])
  })

  it('falla con 502 si Siigo no devuelve id', () => {
    expect(captureError(() => normalizeSiigoCustomer({ name: ['María'] })))
      .toMatchObject({ statusCode: 502 })
  })

  it('falla con 502 si no hay ningún nombre utilizable', () => {
    expect(captureError(() => normalizeSiigoCustomer({ id, name: [] })))
      .toMatchObject({ statusCode: 502 })
  })
})
