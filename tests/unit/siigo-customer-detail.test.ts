import { describe, expect, it, vi } from 'vitest'
import { getSiigoCustomerDetail } from '../../server/utils/siigo-customer-detail'

vi.mock('../../server/utils/prisma', () => ({ usePrisma: vi.fn() }))

const customerId = '9bf22cf2-ba6b-4030-b9a6-3286ea440b61'

describe('detalle de cliente Siigo', () => {
  it('usa el endpoint puntual para obtener la fecha real y conserva los datos internos', async () => {
    const getLocal = vi.fn().mockResolvedValue({
      id: customerId,
      name: ['Cliente local'],
      metadata: { created: '0001-01-01T00:00:00' },
      internal: {
        code: 'CLI-001',
        notes: null,
        tags: [],
        sync_status: 'synced',
        sync_version: 1,
        synced_at: '2026-08-18T19:42:01.245Z'
      }
    })
    const request = vi.fn().mockResolvedValue({
      id: customerId,
      name: ['Cliente desde Siigo'],
      metadata: {
        created: '2026-07-29T00:57:28.537',
        last_updated: '2026-08-18T19:42:01.17'
      }
    })

    const customer = await getSiigoCustomerDetail(customerId, { getLocal, request })

    expect(request).toHaveBeenCalledWith(`/v1/customers/${customerId}`, { method: 'GET' })
    expect(customer).toMatchObject({
      name: ['Cliente desde Siigo'],
      metadata: { created: '2026-07-29T00:57:28.537' },
      internal: { code: 'CLI-001' }
    })
  })

  it('no consulta Siigo cuando el cliente no existe localmente', async () => {
    const getLocal = vi.fn().mockResolvedValue(null)
    const request = vi.fn()

    await expect(getSiigoCustomerDetail(customerId, { getLocal, request })).resolves.toBeNull()
    expect(request).not.toHaveBeenCalled()
  })
})
