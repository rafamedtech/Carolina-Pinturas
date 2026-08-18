import { describe, expect, it, vi } from 'vitest'
import type { SiigoCustomer, SiigoListResponse } from '../../app/types/siigo'
import { synchronizeSiigoCustomers } from '../../server/utils/siigo-customer-import'

vi.mock('../../server/utils/prisma', () => ({ usePrisma: vi.fn() }))

function customer(index: number): SiigoCustomer {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: [`Cliente ${index}`]
  }
}

describe('importación de clientes Siigo → PostgreSQL', () => {
  it('pagina de 100 en 100 y persiste en lotes acotados', async () => {
    const customers = Array.from({ length: 205 }, (_, index) => customer(index + 1))
    const fetchPage = vi.fn(async (page: number, pageSize: number): Promise<SiigoListResponse<SiigoCustomer>> => ({
      results: customers.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page, page_size: pageSize, total_results: customers.length }
    }))
    const persistBatch = vi.fn().mockResolvedValue(undefined)

    const result = await synchronizeSiigoCustomers({
      fetchPage,
      persistBatch,
      now: () => new Date('2026-08-18T17:00:00.000Z')
    })

    expect(fetchPage.mock.calls).toEqual([[1, 100], [2, 100], [3, 100]])
    expect(persistBatch).toHaveBeenCalledTimes(9)
    expect(persistBatch.mock.calls.every(([batch]) => batch.length <= 25)).toBe(true)
    expect(result).toEqual({
      received: 205,
      synchronized: 205,
      synchronized_at: '2026-08-18T17:00:00.000Z'
    })
  })

  it('no persiste un catálogo incompleto si falla una página de Siigo', async () => {
    const fetchPage = vi.fn(async (page: number): Promise<SiigoListResponse<SiigoCustomer>> => {
      if (page === 2) throw new Error('Siigo no respondió')
      return {
        results: Array.from({ length: 100 }, (_, index) => customer(index + 1)),
        pagination: { page: 1, page_size: 100, total_results: 101 }
      }
    })
    const persistBatch = vi.fn().mockResolvedValue(undefined)

    await expect(synchronizeSiigoCustomers({
      fetchPage,
      persistBatch,
      now: () => new Date()
    })).rejects.toThrow('Siigo no respondió')
    expect(persistBatch).not.toHaveBeenCalled()
  })

  it('deduplica sincronizaciones concurrentes', async () => {
    let resolvePage: ((value: SiigoListResponse<SiigoCustomer>) => void) | undefined
    const fetchPage = vi.fn(() => new Promise<SiigoListResponse<SiigoCustomer>>((resolve) => {
      resolvePage = resolve
    }))
    const persistBatch = vi.fn().mockResolvedValue(undefined)
    const dependencies = { fetchPage, persistBatch, now: () => new Date() }

    const first = synchronizeSiigoCustomers(dependencies)
    const second = synchronizeSiigoCustomers(dependencies)
    expect(first).toBe(second)

    resolvePage?.({ results: [], pagination: { page: 1, page_size: 100, total_results: 0 } })
    await first
    expect(fetchPage).toHaveBeenCalledOnce()
  })
})
