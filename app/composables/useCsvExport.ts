import { collectPages } from '@rafamedtech/nuxt-shared/utils'

interface PageResponse<T> {
  results?: T[]
  pagination?: { totalPages?: number }
}

/**
 * Recorre un endpoint paginado y devuelve todos los registros filtrados.
 * Reutiliza los mismos filtros del listado, solicitando páginas de 100.
 */
export async function fetchAllPages<T>(
  url: string,
  query: Record<string, unknown> = {},
  pageSize = 100,
  fetcher: <R>(url: string, options: { query: Record<string, unknown> }) => Promise<R> = $fetch
): Promise<T[]> {
  return collectPages(async (index) => {
    const page = index + 1
    const response = await fetcher<PageResponse<T>>(url, {
      query: { ...query, page, page_size: pageSize }
    })
    const rows = response.results ?? []
    return { rows, done: !rows.length || page >= (response.pagination?.totalPages ?? 1) }
  })
}
