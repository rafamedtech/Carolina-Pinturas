import { describe, expect, it } from 'vitest'
import type { CreateCustomerInput } from '../../server/utils/customer-validation'
import {
  buildSiigoCustomerPayload,
  buildSiigoCustomerUpdatePayload,
  customerFromSiigoWrite,
  normalizeSiigoCustomer,
  normalizeSiigoCustomerList,
  reconcileSiigoCustomer,
  siigoStreetForPublicApi
} from '../../server/utils/siigo-customers'

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
    expect(buildSiigoCustomerPayload(physicalInput({
      commercialName: 'Pinturas María',
      branchOffice: 2,
      active: true,
      sellerId: 21,
      collectorId: 34,
      address: {
        ...physicalInput().address,
        locality: 'Cuauhtémoc'
      },
      internal: { code: 'CLI-001', notes: 'Crédito autorizado', tags: ['mayoreo'] }
    }))).toEqual({
      person_type: 'Physical',
      rfc_id: 'LOMA850101AB1',
      name: ['María', 'López'],
      commercial_name: 'Pinturas María',
      branch_office: 2,
      fiscal_regime: '616',
      active: true,
      address: {
        address: 'Av. Reforma',
        exterior_number: '123',
        interior_number: '4B',
        colony: 'Centro',
        locality: 'Cuauhtémoc',
        postal_code: '06000',
        city: { country_code: 'Mx', state_code: '09', city_code: '001' }
      },
      phones: [{ number: '5512345678' }],
      contacts: [{ first_name: 'María', last_name: 'López', email: 'maria@example.com' }],
      comments: 'Cliente de mostrador',
      seller_id: 21,
      collector_id: 34
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
        city: { country_code: 'Mx', state_code: '09', city_code: '001' }
      },
      contacts: [{ first_name: 'Pinturas Industriales SA de CV' }]
    })
    expect(payload).not.toHaveProperty('phones')
    expect(payload).not.toHaveProperty('fiscal_regime')
    expect(payload).not.toHaveProperty('comments')
    expect(payload).not.toHaveProperty('type')
    expect(payload).not.toHaveProperty('active')

    walkValues(payload, (value) => {
      expect(value).not.toBeUndefined()
      expect(value).not.toBeNull()
      expect(value).not.toBe('')
    })
  })

  it('siempre envía Mx para una persona física aunque el snapshot tenga otro país', () => {
    const payload = buildSiigoCustomerPayload(physicalInput({
      address: {
        ...physicalInput().address,
        city: { countryCode: 'US', stateCode: '2', cityCode: '4' }
      }
    }))

    expect(payload.address.city).toEqual({
      country_code: 'Mx',
      state_code: '02',
      city_code: '004'
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
    expect(payload.address.city.country_code).toBe('Us')
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

describe('buildSiigoCustomerUpdatePayload', () => {
  it('usa el Mx canónico y conserva el tipo de persona vigente', () => {
    const payload = buildSiigoCustomerUpdatePayload(
      physicalInput({
        address: {
          ...physicalInput().address,
          city: { countryCode: 'MX', stateCode: '2', cityCode: '4' }
        }
      }),
      {
        id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
        name: ['María', 'López'],
        person_type: 'Moral',
        address: {
          city: { country_code: 'US', state_code: '5', city_code: '2' }
        }
      }
    )

    expect(payload.address.city).toEqual({
      country_code: 'Mx',
      state_code: '02',
      city_code: '004'
    })
    expect(payload.address).toMatchObject({ address: 'Av. Reforma', street: 'Av. Reforma' })
    expect(payload.person_type).toBe('Moral')
  })

  it('envía la dirección con Mx y conserva Supplier cuando el cliente vigente no tiene país', () => {
    const payload = buildSiigoCustomerUpdatePayload(physicalInput({ email: undefined }), {
      id: '9bf22cf2-ba6b-4030-b9a6-3286ea440b61',
      name: ['Rafael', 'Amed Valenzuela González'],
      person_type: 'Physical',
      type: 'Supplier',
      address: {
        city: { city_code: '4', city_name: 'Tijuana' }
      }
    })

    expect(payload.type).toBe('Supplier')
    expect(payload.person_type).toBe('Physical')
    expect(payload.address).toMatchObject({
      address: 'Av. Reforma',
      street: 'Av. Reforma',
      exterior_number: '123',
      interior_number: '4B',
      colony: 'Centro',
      postal_code: '06000',
      city: { country_code: 'Mx', state_code: '09', city_code: '001' }
    })
    expect(payload.address.street).toBe('Av. Reforma')
    expect(payload).not.toHaveProperty('contacts')
  })

  it('conserva la calle completa y abrevia el campo legado del PUT a 20 caracteres', () => {
    const payload = buildSiigoCustomerUpdatePayload(physicalInput({
      address: {
        ...physicalInput().address,
        street: 'BOULEVARD (BLVD.) MANUEL J. CLOUTHIER'
      }
    }), {
      id: '6824bfe4-a93d-4eaa-aa88-95fea673b53b',
      name: ['ILEINN ELISABET', 'LOPEZ SAUCEDA'],
      person_type: 'Physical'
    })

    expect(payload.address.address).toBe('BOULEVARD (BLVD.) MANUEL J. CLOUTHIER')
    expect(payload.address.street).toBe('BLVD MAN. CLOUTHIER')
    expect(payload.address.street.length).toBeLessThanOrEqual(20)
  })
})

describe('siigoStreetForPublicApi', () => {
  it('deja intacta una calle que ya cabe', () => {
    expect(siigoStreetForPublicApi('Calle 5')).toBe('Calle 5')
  })

  it('abrevia una dirección larga sin cortar el nombre principal', () => {
    expect(siigoStreetForPublicApi('BOULEVARD (BLVD.) MANUEL J. CLOUTHIER'))
      .toBe('BLVD MAN. CLOUTHIER')
  })
})

describe('normalizeSiigoCustomer', () => {
  it('usa el nombre comercial cuando Siigo devuelve name sin valores útiles', () => {
    const response = normalizeSiigoCustomerList({
      results: [{
        id: '048fac97-d25e-4724-bbea-c9c731c22656',
        name: [null],
        commercial_name: 'INDUSTRIAS POLYPLASTIC LA FORTUNA',
        rfc_id: 'IPF1611092Z3'
      }],
      pagination: { page: 1, page_size: 100, total_results: 1 }
    })

    expect(response.results[0]).toMatchObject({
      id: '048fac97-d25e-4724-bbea-c9c731c22656',
      name: ['INDUSTRIAS POLYPLASTIC LA FORTUNA'],
      commercial_name: 'INDUSTRIAS POLYPLASTIC LA FORTUNA',
      rfc_id: 'IPF1611092Z3'
    })
    expect(response.pagination?.total_results).toBe(1)
  })

  const id = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'

  it('conserva name cuando llega como arreglo', () => {
    const customer = normalizeSiigoCustomer({ id, name: ['María', 'López'], rfc_id: 'LOMA850101AB1' })
    expect(customer.id).toBe(id)
    expect(customer.name).toEqual(['María', 'López'])
  })

  it('convierte name string a arreglo', () => {
    expect(normalizeSiigoCustomer({ id, name: 'Pinturas SA' }).name).toEqual(['Pinturas SA'])
  })

  it('normaliza las variantes de respuesta documentadas sin perder datos fiscales', () => {
    const customer = normalizeSiigoCustomer({
      id,
      name: 'Pinturas SA',
      fiscal_regime: [{ code: '601', name: 'General de Ley' }],
      address: {
        address: 'Av. Principal',
        city: { country_code: 'MX', state_code: '02', city_code: '001' }
      },
      phones: { indicative: '52', number: '5512345678', extension: '10' },
      contacts: {
        first_name: 'Ana',
        phone: { indicative: '52', number: '5587654321', extension: '20' }
      },
      related_users: { seller_id: 21, collector_id: 34 }
    })

    expect(customer).toMatchObject({
      fiscal_regime: '601',
      address: {
        street: 'Av. Principal',
        city: { country_code: 'MX', state_code: '02', city_code: '001' }
      },
      phones: [{ indicative: '52', number: '5512345678', extension: '10' }],
      contacts: [{
        first_name: 'Ana',
        phone: { indicative: '52', number: '5587654321', extension: '20' }
      }],
      seller_id: 21,
      collector_id: 34
    })
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

describe('reconciliación Siigo/PostgreSQL', () => {
  const id = '6824bfe4-a93d-4eaa-aa88-95fea673b53b'

  it('completa la respuesta PUT con el formato exacto enviado a Siigo', () => {
    const payload = buildSiigoCustomerUpdatePayload(physicalInput({
      name: ['ILEINN ELISABET', 'LOPEZ SAUCEDA'],
      rfcId: 'LOSI981025CK1',
      address: {
        street: 'BOULEVARD (BLVD.) MANUEL J. CLOUTHIER',
        exteriorNumber: '22216',
        colony: 'Ampliación Guaycura',
        postalCode: '22214',
        city: { countryCode: 'MX', stateCode: '2', cityCode: '4' }
      }
    }), {
      id,
      name: ['ILEINN ELISABET', 'LOPEZ SAUCEDA'],
      person_type: 'Physical'
    })
    const external = normalizeSiigoCustomer({
      id,
      name: ['ILEINN ELISABET', 'LOPEZ SAUCEDA'],
      address: {
        exterior_number: '22216',
        postal_code: '22214',
        city: { country_code: 'Mx', state_code: '02', city_code: '004' }
      }
    })

    expect(customerFromSiigoWrite(external, payload)).toMatchObject({
      address: {
        street: 'BOULEVARD (BLVD.) MANUEL J. CLOUTHIER',
        exterior_number: '22216',
        colony: 'Ampliación Guaycura',
        postal_code: '22214',
        city: { country_code: 'Mx', state_code: '02', city_code: '004' }
      }
    })
  })

  it('Siigo manda en claves presentes y PostgreSQL respalda claves omitidas', () => {
    const local = normalizeSiigoCustomer({
      id,
      name: ['ILEINN ELISABET', 'LOPEZ SAUCEDA'],
      address: {
        street: 'BOULEVARD (BLVD.) MANUEL J. CLOUTHIER',
        exterior_number: '22216',
        colony: 'Ampliación Guaycura',
        city: { country_code: 'Mx', state_code: '02', city_code: '004' }
      },
      contacts: [{ first_name: 'ILEINN', email: 'ileinn.fg@outlook.com' }]
    })
    const raw = {
      id,
      name: ['ILEINN ELISABET', 'LOPEZ SAUCEDA'],
      address: {
        street: '',
        exterior_number: '999',
        colony: '',
        city: { country_code: 'Mx', state_code: '02', city_code: '004' }
      },
      contacts: []
    }
    const external = normalizeSiigoCustomer(raw)

    expect(reconcileSiigoCustomer(external, local, raw)).toMatchObject({
      address: {
        street: 'BOULEVARD (BLVD.) MANUEL J. CLOUTHIER',
        exterior_number: '999',
        colony: 'Ampliación Guaycura'
      },
      contacts: []
    })
  })
})
