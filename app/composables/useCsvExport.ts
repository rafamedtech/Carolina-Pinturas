import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { CsvColumn } from '~/utils/csv'
import { csvFilename, downloadCsv, toCsv } from '~/utils/csv'

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
  const rows: T[] = []
  let page = 1

  while (true) {
    const response = await fetcher<PageResponse<T>>(url, {
      query: { ...query, page, page_size: pageSize }
    })
    const pageRows = response.results ?? []
    rows.push(...pageRows)

    const totalPages = response.pagination?.totalPages ?? 1
    if (!pageRows.length || page >= totalPages) break
    page += 1
  }

  return rows
}

export interface CsvExportOptions<T> {
  filename: MaybeRefOrGetter<string>
  columns: MaybeRefOrGetter<readonly CsvColumn<T>[]>
  rows?: MaybeRefOrGetter<readonly T[] | undefined>
  fetchAll?: () => Promise<readonly T[]>
  emptyMessage?: MaybeRefOrGetter<string | undefined>
}

export function useCsvExport<T>(options: CsvExportOptions<T>) {
  const exporting = ref(false)
  const toast = useToast()

  async function exportCsv() {
    if (exporting.value) return
    exporting.value = true

    try {
      const rows = options.fetchAll
        ? await options.fetchAll()
        : [...(toValue(options.rows) ?? [])]

      if (!rows.length) {
        toast.add({
          title: 'Sin datos para exportar',
          description: toValue(options.emptyMessage) || 'Ajusta los filtros e inténtalo de nuevo.',
          color: 'warning',
          icon: 'i-lucide-circle-alert'
        })
        return
      }

      const filename = csvFilename(toValue(options.filename))
      downloadCsv(filename, toCsv([...toValue(options.columns)], rows))
      toast.add({
        title: 'CSV descargado',
        description: `${rows.length} ${rows.length === 1 ? 'registro exportado' : 'registros exportados'}.`,
        color: 'success',
        icon: 'i-lucide-circle-check'
      })
    } catch (error: unknown) {
      const fetchError = error as { data?: { statusMessage?: string }, message?: string }
      toast.add({
        title: 'No se pudo exportar',
        description: fetchError.data?.statusMessage || fetchError.message || 'Intenta nuevamente.',
        color: 'error',
        icon: 'i-lucide-triangle-alert'
      })
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportCsv }
}
