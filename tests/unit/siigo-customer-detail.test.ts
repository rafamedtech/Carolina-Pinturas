import { describe, expect, it, vi } from 'vitest'
import { getSiigoCustomerDetail } from '../../server/utils/siigo-customer-detail'

vi.mock('../../server/utils/prisma', () => ({ usePrisma: vi.fn() }))

const customerId = '9bf22cf2-ba6b-4030-b9a6-3286ea440b61'

describe('detalle de cliente Siigo', () => {
  it('obtiene siempre el cliente puntual de Siigo y agrega sólo los datos internos', async () => {
    const internal = {
      code: 'CLI-001',
      notes: null,
      tags: [],
      requires_invoice: true,
      sync_status: 'synced',
      sync_version: 1,
      synced_at: '2026-08-18T19:42:01.245Z'
    }
    const getInternal = vi.fn().mockResolvedValue(internal)
    const request = vi.fn().mockResolvedValue({
      id: customerId,
      name: ['Cliente desde Siigo'],
      address: {
        street: 'Calle vigente en Siigo',
        city: { country_code: 'Mx', state_code: '02', city_code: '004' }
      },
      metadata: { created: '2026-07-29T00:57:28.537' }
    })

    const customer = await getSiigoCustomerDetail(customerId, { getInternal, request })

    expect(request).toHaveBeenCalledWith(`/v1/customers/${customerId}`, { method: 'GET' })
    expect(getInternal).toHaveBeenCalledWith(customerId)
    expect(customer).toMatchObject({
      name: ['Cliente desde Siigo'],
      address: { street: 'Calle vigente en Siigo' },
      internal: { code: 'CLI-001', requires_invoice: true }
    })
  })

  it('responde con Siigo aunque el cliente no tenga registro local', async () => {
    const getInternal = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({
      id: customerId,
      name: ['Cliente sólo en Siigo'],
      rfc_id: 'PIN900101AB1'
    })

    await expect(getSiigoCustomerDetail(customerId, { getInternal, request }))
      .resolves.toMatchObject({
        id: customerId,
        name: ['Cliente sólo en Siigo'],
        rfc_id: 'PIN900101AB1'
      })
  })

  it('no completa con PostgreSQL los campos que Siigo omite', async () => {
    const getInternal = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({
      id: customerId,
      name: ['ILEINN ELISABET', 'LOPEZ SAUCEDA'],
      address: {
        exterior_number: '22216',
        city: { country_code: 'Mx', state_code: '02', city_code: '004' }
      }
    })

    const customer = await getSiigoCustomerDetail(customerId, { getInternal, request })

    expect(customer.address).toMatchObject({ exterior_number: '22216' })
    expect(customer.address?.street).toBeUndefined()
    expect(customer.address?.colony).toBeUndefined()
  })
})
