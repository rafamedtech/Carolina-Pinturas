import { describe, expect, it } from 'vitest'
import type { SiigoCustomer } from '../../app/types/siigo'
import {
  missingSiigoCustomerFields,
  siigoCustomerMutationInput
} from '../../app/utils/siigoCustomerMutation'

const customer: SiigoCustomer = {
  id: '6b6ceb28-b2eb-4b98-b3dd-26648a933c81',
  name: ['Pinturas Industriales SA de CV'],
  person_type: 'moral',
  rfc_id: 'PIN900101AB1',
  active: true,
  contacts: [{ email: 'ventas@example.com' }],
  phones: [{ number: '6641234567' }],
  address: {
    street: 'Calle 5',
    city: { country_code: 'MX', state_code: '02', city_code: '001' }
  },
  internal: {
    code: 'CLI-001',
    notes: 'Mayoreo',
    tags: ['mayoreo'],
    sync_status: 'synced',
    sync_version: 2,
    synced_at: '2026-08-18T00:00:00.000Z'
  }
}

describe('payload de edición de clientes', () => {
  it('convierte el snapshot local en un PUT completo y conserva campos internos', () => {
    expect(siigoCustomerMutationInput(customer, { active: false })).toEqual(expect.objectContaining({
      personType: 'Moral',
      name: ['Pinturas Industriales SA de CV'],
      rfcId: 'PIN900101AB1',
      active: false,
      email: 'ventas@example.com',
      phone: '6641234567',
      internal: { code: 'CLI-001', notes: 'Mayoreo', tags: ['mayoreo'] },
      address: expect.objectContaining({
        street: 'Calle 5',
        city: { countryCode: 'Mx', stateCode: '02', cityCode: '001' }
      })
    }))
  })

  it('corrige a Mx el país histórico de una persona física', () => {
    const input = siigoCustomerMutationInput({
      ...customer,
      person_type: 'Physical',
      name: ['María', 'López'],
      rfc_id: 'LOMA850101AB1',
      address: {
        ...customer.address,
        city: { country_code: 'US', state_code: '2', city_code: '4' }
      }
    })

    expect(input.personType).toBe('Physical')
    expect(input.address.city.countryCode).toBe('Mx')
  })

  it('detecta datos obligatorios ausentes antes de activar o archivar', () => {
    const input = siigoCustomerMutationInput({
      ...customer,
      address: { city: { country_code: 'MX' } }
    })

    expect(missingSiigoCustomerFields(input)).toEqual([
      'calle',
      'código de estado',
      'código de ciudad'
    ])
  })
})
