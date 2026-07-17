import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiigoListResponse } from '../../app/types/siigo'
import {
  cachedSiigoCatalog,
  clearSiigoCatalogCache,
  collectSiigoCatalog,
  invalidateSiigoCatalog,
  SIIGO_FULL_CATALOG_PAGE_SIZE
} from '../../server/utils/siigo-catalog'

interface CatalogItem {
  id: number
}

function response(results: CatalogItem[], totalResults = results.length): SiigoListResponse<CatalogItem> {
  return {
    results,
    pagination: { page: 1, page_size: SIIGO_FULL_CATALOG_PAGE_SIZE, total_results: totalResults }
  }
}

describe('catálogos completos de Siigo', () => {
  beforeEach(() => clearSiigoCatalogCache())

  it('usa páginas de 100 y reúne todas las páginas secuencialmente', async () => {
    const fetchPage = vi.fn(async (page: number, _pageSize: number) => (
      response([{ id: page }], 201)
    ))

    const catalog = await collectSiigoCatalog(fetchPage)

    expect(fetchPage.mock.calls).toEqual([[1, 100], [2, 100], [3, 100]])
    expect(catalog.results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(catalog.pagination?.total_results).toBe(3)
  })

  it('comparte una sola carga entre solicitudes concurrentes y conserva el resultado cinco minutos', async () => {
    let finishLoad: ((value: SiigoListResponse<CatalogItem>) => void) | undefined
    const loader = vi.fn(() => new Promise<SiigoListResponse<CatalogItem>>((resolve) => {
      finishLoad = resolve
    }))
    let now = 1_000

    const first = cachedSiigoCatalog('products', loader, { now: () => now })
    const concurrent = cachedSiigoCatalog('products', loader, { now: () => now })
    finishLoad?.(response([{ id: 1 }]))

    await expect(Promise.all([first, concurrent])).resolves.toEqual([
      response([{ id: 1 }]),
      response([{ id: 1 }])
    ])
    now += 299_999
    await expect(cachedSiigoCatalog('products', loader, { now: () => now }))
      .resolves.toEqual(response([{ id: 1 }]))
    expect(loader).toHaveBeenCalledOnce()
  })

  it('entrega el catálogo anterior si la actualización recibe 429', async () => {
    let now = 1_000
    const initial = response([{ id: 1 }])

    await cachedSiigoCatalog('customers', async () => initial, { ttlMs: 100, now: () => now })
    now += 101

    await expect(cachedSiigoCatalog('customers', async () => {
      throw Object.assign(new Error('Too many requests'), { statusCode: 429 })
    }, { ttlMs: 100, now: () => now })).resolves.toBe(initial)
  })

  it('invalida un catálogo después de una escritura relacionada', async () => {
    const loader = vi.fn()
      .mockResolvedValueOnce(response([{ id: 1 }]))
      .mockResolvedValueOnce(response([{ id: 2 }]))

    await cachedSiigoCatalog('customers', loader)
    invalidateSiigoCatalog('customers')

    await expect(cachedSiigoCatalog('customers', loader))
      .resolves.toEqual(response([{ id: 2 }]))
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('no oculta errores permanentes con datos anteriores', async () => {
    let now = 1_000

    await cachedSiigoCatalog('customers', async () => response([{ id: 1 }]), {
      ttlMs: 100,
      now: () => now
    })
    now += 101

    await expect(cachedSiigoCatalog('customers', async () => {
      throw Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    }, { ttlMs: 100, now: () => now })).rejects.toMatchObject({ statusCode: 401 })
  })
})
