import { describe, expect, it } from 'vitest'
import { createCustomerSchema } from '../../server/utils/customer-validation'

const validPhysical = {
  personType: 'Physical',
  name: ['María', 'López'],
  rfcId: 'loma850101ab1',
  address: {
    street: 'Av. Reforma 123',
    city: { countryCode: 'MX', stateCode: '9', cityCode: '1' }
  }
}

const validMoral = {
  personType: 'Moral',
  name: ['Pinturas Industriales SA de CV'],
  rfcId: 'PIN900101AB1',
  address: {
    street: 'Calle 5',
    city: { countryCode: 'MX', stateCode: '9', cityCode: '1' }
  }
}

function errorPaths(input: unknown): string[] {
  const result = createCustomerSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.map(issue => issue.path.join('.'))
}

describe('createCustomerSchema', () => {
  it('acepta persona física válida y normaliza el RFC a mayúsculas', () => {
    const result = createCustomerSchema.safeParse(validPhysical)
    expect(result.success).toBe(true)
    expect(result.success && result.data.rfcId).toBe('LOMA850101AB1')
  })

  it('acepta persona moral con RFC de 12 caracteres', () => {
    expect(createCustomerSchema.safeParse(validMoral).success).toBe(true)
  })

  it('acepta extranjero con RFC genérico sin validar el patrón', () => {
    const result = createCustomerSchema.safeParse({
      ...validMoral,
      personType: 'Foreign',
      rfcId: 'XEXX010101000'
    })
    expect(result.success).toBe(true)
  })

  it('rechaza persona física con un solo campo de nombre', () => {
    expect(errorPaths({ ...validPhysical, name: ['María'] })).toContain('name')
  })

  it('rechaza persona moral con dos campos de nombre', () => {
    expect(errorPaths({ ...validMoral, name: ['Pinturas', 'SA'] })).toContain('name')
  })

  it('rechaza RFC de persona física que no cumple el patrón de 13 caracteres', () => {
    expect(errorPaths({ ...validPhysical, rfcId: 'PIN900101AB1' })).toContain('rfcId')
  })

  it('rechaza RFC de persona moral que no cumple el patrón de 12 caracteres', () => {
    expect(errorPaths({ ...validMoral, rfcId: 'LOMA850101AB1' })).toContain('rfcId')
  })

  it('rechaza dirección sin calle', () => {
    expect(errorPaths({
      ...validPhysical,
      address: { ...validPhysical.address, street: '' }
    })).toContain('address.street')
  })

  it('rechaza ciudad sin códigos', () => {
    const paths = errorPaths({
      ...validPhysical,
      address: { street: 'Av. Reforma', city: { countryCode: '', stateCode: '', cityCode: '' } }
    })
    expect(paths).toEqual(expect.arrayContaining([
      'address.city.countryCode',
      'address.city.stateCode',
      'address.city.cityCode'
    ]))
  })

  it('rechaza código postal, teléfono y correo con formato inválido', () => {
    expect(errorPaths({
      ...validPhysical,
      email: 'no-es-correo',
      phone: '12 34',
      address: { ...validPhysical.address, postalCode: '123' }
    })).toEqual(expect.arrayContaining(['email', 'phone', 'address.postalCode']))
  })
})
