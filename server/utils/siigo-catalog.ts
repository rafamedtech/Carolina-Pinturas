import type { SiigoListResponse } from '~/types/siigo'

export const SIIGO_FULL_CATALOG_PAGE_SIZE = 100
export const SIIGO_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000

type FetchCatalogPage<T> = (page: number, pageSize: number) => Promise<SiigoListResponse<T>>

interface CatalogCacheEntry<T> {
  value: SiigoListResponse<T>
  expiresAt: number
}

const catalogCache = new Map<string, CatalogCacheEntry<unknown>>()
const catalogRequests = new Map<string, Promise<SiigoListResponse<unknown>>>()

export async function collectSiigoCatalog<T>(
  fetchPage: FetchCatalogPage<T>,
  pageSize = SIIGO_FULL_CATALOG_PAGE_SIZE
): Promise<SiigoListResponse<T>> {
  const firstPage = await fetchPage(1, pageSize)
  const results = [...firstPage.results]
  const totalResults = firstPage.pagination?.total_results ?? results.length
  const effectivePageSize = firstPage.pagination?.page_size || pageSize
  const totalPages = Math.max(1, Math.ceil(totalResults / effectivePageSize))

  for (let page = 2; page <= totalPages; page++) {
    const response = await fetchPage(page, effectivePageSize)
    results.push(...response.results)
  }

  return {
    results,
    pagination: {
      total_results: results.length,
      page: 1,
      page_size: results.length
    }
  }
}

function isTemporaryCatalogError(error: unknown) {
  const statusCode = (error as { statusCode?: number })?.statusCode
  return statusCode === 429 || Boolean(statusCode && statusCode >= 500)
}

export async function cachedSiigoCatalog<T>(
  key: string,
  loader: () => Promise<SiigoListResponse<T>>,
  options: { ttlMs?: number, now?: () => number } = {}
): Promise<SiigoListResponse<T>> {
  const now = options.now || Date.now
  const ttlMs = options.ttlMs ?? SIIGO_CATALOG_CACHE_TTL_MS
  const cached = catalogCache.get(key) as CatalogCacheEntry<T> | undefined

  if (cached && cached.expiresAt > now()) return cached.value

  const pending = catalogRequests.get(key) as Promise<SiigoListResponse<T>> | undefined
  if (pending) return pending

  const request = loader()
    .then((value) => {
      catalogCache.set(key, { value, expiresAt: now() + ttlMs })
      return value
    })
    .catch((error: unknown) => {
      if (cached && isTemporaryCatalogError(error)) return cached.value
      throw error
    })
    .finally(() => {
      catalogRequests.delete(key)
    })

  catalogRequests.set(key, request as Promise<SiigoListResponse<unknown>>)
  return request
}

export function clearSiigoCatalogCache() {
  catalogCache.clear()
  catalogRequests.clear()
}

export function invalidateSiigoCatalog(key: string) {
  catalogCache.delete(key)
}
