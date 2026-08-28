import { describe, expect, it, vi } from 'vitest'
import type { CreateCustomerInput } from '../../server/utils/customer-validation'
import {
  createSynchronizedSiigoCustomer,
  updateSynchronizedSiigoCustomer
} from '../../server/utils/siigo-customer-sync'

vi.mock('../../server/utils/prisma', () => ({ usePrisma: vi.fn() }))

const customerId = '6b6ceb28-b2eb-4b98-b3dd-26648a933c81'

function input(): CreateCustomerInput {
  return {
    personType: 'Moral',
    name: ['Pinturas Industriales SA de CV'],
    rfcId: 'PIN900101AB1',
    commercialName: 'Pinturas Industriales',
    active: true,
    internal: { code: 'CLI-001', notes: 'Cuenta de mayoreo', tags: ['mayoreo'] },
    address: {
      street: 'Calle 5',
      city: { countryCode: 'MX', stateCode: '02', cityCode: '001' }
    }
  }
}

function dependencies() {
  return {
    assertInternalCodeAvailable: vi.fn().mockResolvedValue(undefined),
    request: vi.fn().mockResolvedValue({
      id: customerId,
      name: 'Pinturas Industriales SA de CV',
      rfc_id: 'PIN900101AB1'
    }),
    persist: vi.fn().mockResolvedValue(undefined),
    invalidate: vi.fn()
  }
}

describe('sincronización de clientes Siigo/PostgreSQL', () => {
  it('crea primero en Siigo y confirma el mismo cliente en PostgreSQL', async () => {
    const deps = dependencies()

    const customer = await createSynchronizedSiigoCustomer(input(), 'admin@example.com', deps)

    expect(deps.assertInternalCodeAvailable).toHaveBeenCalledWith('CLI-001', undefined)
    expect(deps.request).toHaveBeenCalledWith('/v1/customers', {
      method: 'POST',
      body: expect.objectContaining({
        person_type: 'Moral',
        rfc_id: 'PIN900101AB1',
        commercial_name: 'Pinturas Industriales'
      })
    })
    expect(deps.invalidate).toHaveBeenCalledOnce()
    expect(deps.persist).toHaveBeenCalledWith(
      expect.objectContaining({ id: customerId, name: ['Pinturas Industriales SA de CV'] }),
      input(),
      'admin@example.com',
      expect.objectContaining({ id: customerId })
    )
    expect(customer.id).toBe(customerId)
  })

  it('actualiza con PUT y el payload completo antes de persistir localmente', async () => {
    const deps = dependencies()
    deps.request
      .mockResolvedValueOnce({
        id: customerId,
        name: 'Pinturas Industriales SA de CV',
        person_type: 'Moral',
        address: {
          city: { country_code: 'US', state_code: '5', city_code: '2' }
        }
      })
      .mockResolvedValueOnce({
        id: customerId,
        name: 'Pinturas Industriales SA de CV',
        rfc_id: 'PIN900101AB1',
        address: {
          street: 'Calle 5',
          city: { country_code: 'Mx', state_code: '02', city_code: '001' }
        }
      })
      .mockResolvedValueOnce({
        id: customerId,
        name: 'Pinturas Industriales SA de CV',
        rfc_id: 'PIN900101AB1',
        address: {
          street: 'Calle 5',
          city: { country_code: 'Mx', state_code: '02', city_code: '001' }
        }
      })

    await updateSynchronizedSiigoCustomer(customerId, input(), 'admin@example.com', deps)

    expect(deps.assertInternalCodeAvailable).toHaveBeenCalledWith('CLI-001', customerId)
    expect(deps.request).toHaveBeenNthCalledWith(1, `/v1/customers/${customerId}`, {
      method: 'GET'
    })
    expect(deps.request).toHaveBeenCalledWith(`/v1/customers/${customerId}`, {
      method: 'PUT',
      body: expect.objectContaining({
        person_type: 'Moral',
        rfc_id: 'PIN900101AB1',
        name: 'Pinturas Industriales SA de CV',
        address: expect.objectContaining({
          address: 'Calle 5',
          street: 'Calle 5',
          city: { country_code: 'Mx', state_code: '02', city_code: '001' }
        })
      })
    })
    expect(deps.request).toHaveBeenNthCalledWith(3, `/v1/customers/${customerId}`, {
      method: 'GET'
    })
    expect(deps.persist).toHaveBeenCalledOnce()
  })

  it('envía dirección con Mx al PUT de un Supplier existente que no tiene país', async () => {
    const deps = dependencies()
    deps.request
      .mockResolvedValueOnce({
        id: customerId,
        name: ['Rafael', 'Amed Valenzuela González'],
        type: 'Supplier',
        person_type: 'Physical',
        address: {
          city: { city_code: '4', city_name: 'Tijuana' }
        }
      })
      .mockResolvedValueOnce({
        id: customerId,
        name: ['Rafael', 'Amed Valenzuela González'],
        type: 'Supplier',
        person_type: 'Physical',
        address: {
          street: 'Calle 5',
          city: { country_code: 'Mx', state_code: '02', city_code: '001' }
        }
      })
      .mockResolvedValueOnce({
        id: customerId,
        name: ['Rafael', 'Amed Valenzuela González'],
        type: 'Supplier',
        person_type: 'Physical',
        address: {
          street: 'Calle 5',
          city: { country_code: 'Mx', state_code: '02', city_code: '001' }
        }
      })

    const physicalInput = {
      ...input(),
      personType: 'Physical' as const,
      name: ['Rafael', 'Amed Valenzuela González'],
      rfcId: 'VAGR8902073DA'
    }

    await updateSynchronizedSiigoCustomer(customerId, physicalInput, 'admin@example.com', deps)

    const putCall = deps.request.mock.calls[1]
    expect(putCall?.[1]).toMatchObject({
      method: 'PUT',
      body: {
        type: 'Supplier',
        person_type: 'Physical'
      }
    })
    expect(putCall?.[1].body).toMatchObject({
      address: {
        address: 'Calle 5',
        street: 'Calle 5',
        city: { country_code: 'Mx', state_code: '02', city_code: '001' }
      }
    })
    expect(putCall?.[1].body).not.toHaveProperty('contacts')
  })

  it('abrevia una calle larga para el PUT y responde con el valor vigente de Siigo', async () => {
    const deps = dependencies()
    const customerWithFullAddress = {
      ...input(),
      address: {
        ...input().address,
        street: 'BOULEVARD (BLVD.) MANUEL J. CLOUTHIER',
        exteriorNumber: '22216',
        colony: 'Ampliación Guaycura',
        postalCode: '22214'
      }
    }

    deps.request
      .mockResolvedValueOnce({
        id: customerId,
        name: 'Pinturas Industriales SA de CV',
        person_type: 'Moral'
      })
      .mockResolvedValueOnce({
        id: customerId,
        name: 'Pinturas Industriales SA de CV',
        address: {
          street: 'BLVD MAN. CLOUTHIER',
          exterior_number: '22216',
          colony: 'Ampliación Guaycura',
          postal_code: '22214',
          city: { country_code: 'Mx', state_code: '02', city_code: '001' }
        }
      })
      .mockResolvedValueOnce({
        id: customerId,
        name: 'Pinturas Industriales SA de CV',
        address: {
          street: 'BLVD MAN. CLOUTHIER',
          exterior_number: '22216',
          colony: 'Ampliación Guaycura',
          postal_code: '22214',
          city: { country_code: 'Mx', state_code: '02', city_code: '001' }
        }
      })

    await expect(updateSynchronizedSiigoCustomer(
      customerId,
      customerWithFullAddress,
      'admin@example.com',
      deps
    )).resolves.toMatchObject({
      address: { street: 'BLVD MAN. CLOUTHIER' }
    })

    expect(deps.request).toHaveBeenCalledTimes(3)
    expect(deps.request.mock.calls[1]?.[1].body).toMatchObject({
      address: {
        address: 'BOULEVARD (BLVD.) MANUEL J. CLOUTHIER',
        street: 'BLVD MAN. CLOUTHIER'
      }
    })
    expect(deps.persist).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.objectContaining({
          street: 'BLVD MAN. CLOUTHIER'
        })
      }),
      customerWithFullAddress,
      'admin@example.com',
      expect.any(Object)
    )
  })

  it('usa y persiste la representación devuelta por Siigo sin mezclar el domicilio local', async () => {
    const deps = dependencies()
    deps.request
      .mockResolvedValueOnce({
        id: customerId,
        name: 'Pinturas Industriales SA de CV',
        person_type: 'Moral'
      })
      .mockResolvedValueOnce({
        id: customerId,
        name: 'Pinturas Industriales SA de CV',
        address: {
          street: 'Calle 5',
          city: { country_code: 'Mx', state_code: '02', city_code: '001' }
        }
      })
      .mockResolvedValueOnce({
        id: customerId,
        name: 'Pinturas Industriales SA de CV',
        address: {
          street: 'Otra calle',
          city: { country_code: 'Mx', state_code: '2', city_code: '1' }
        }
      })

    await expect(updateSynchronizedSiigoCustomer(
      customerId,
      input(),
      'admin@example.com',
      deps
    )).resolves.toMatchObject({
      address: { street: 'Otra calle' }
    })

    expect(deps.request).toHaveBeenCalledTimes(3)
    expect(deps.persist).toHaveBeenCalledWith(
      expect.objectContaining({ address: expect.objectContaining({ street: 'Otra calle' }) }),
      input(),
      'admin@example.com',
      expect.any(Object)
    )
  })

  it('no toca PostgreSQL cuando Siigo rechaza la mutación', async () => {
    const deps = dependencies()
    deps.request.mockRejectedValueOnce(new Error('Siigo rechazó el cliente'))

    await expect(createSynchronizedSiigoCustomer(input(), 'admin@example.com', deps))
      .rejects.toThrow('Siigo rechazó el cliente')
    expect(deps.persist).not.toHaveBeenCalled()
    expect(deps.invalidate).not.toHaveBeenCalled()
  })

  it('no ejecuta el PUT si no puede consultar primero el cliente vigente', async () => {
    const deps = dependencies()
    deps.request.mockRejectedValueOnce(new Error('No se pudo consultar el cliente'))

    await expect(updateSynchronizedSiigoCustomer(customerId, input(), 'admin@example.com', deps))
      .rejects.toThrow('No se pudo consultar el cliente')

    expect(deps.request).toHaveBeenCalledOnce()
    expect(deps.request).toHaveBeenCalledWith(`/v1/customers/${customerId}`, { method: 'GET' })
    expect(deps.persist).not.toHaveBeenCalled()
    expect(deps.invalidate).not.toHaveBeenCalled()
  })

  it('reporta conciliación pendiente y no reintenta Siigo si PostgreSQL falla', async () => {
    const deps = dependencies()
    deps.persist.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(createSynchronizedSiigoCustomer(input(), 'admin@example.com', deps))
      .rejects.toMatchObject({
        statusCode: 500,
        data: { siigoCustomerId: customerId, synchronization: 'pending' }
      })
    expect(deps.request).toHaveBeenCalledOnce()
  })

  it('detiene un código interno duplicado antes de llamar a Siigo', async () => {
    const deps = dependencies()
    deps.assertInternalCodeAvailable.mockRejectedValueOnce(new Error('duplicate internal code'))

    await expect(createSynchronizedSiigoCustomer(input(), 'admin@example.com', deps))
      .rejects.toThrow('duplicate internal code')
    expect(deps.request).not.toHaveBeenCalled()
    expect(deps.persist).not.toHaveBeenCalled()
  })
})
