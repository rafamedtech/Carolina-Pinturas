import { createError } from 'h3'
import type { SatEntry, SatSearchResponse } from '~/types/siigo-products'

export interface SatCatalog {
  retrievedAt: string
  catalogs: Record<'unit' | 'key', { source: string, entries: SatEntry[] }>
}
let catalog: Promise<SatCatalog> | undefined
export function getProductSatCatalog() {
  catalog ??= useStorage('assets:server').getItem<SatCatalog>('sat/catalog.json').then((data) => {
    if (!data?.catalogs?.key?.entries?.length || !data.catalogs.unit.entries.length) {
      throw createError({ statusCode: 503, statusMessage: 'Catálogos SAT no disponibles.' })
    }
    return data
  }).catch((error: unknown) => {
    catalog = undefined
    throw error
  })
  return catalog
}
function searchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX')
}
export function searchProductSat(data: SatCatalog, kind: 'unit' | 'key', query: string, page: number): SatSearchResponse {
  const terms = searchText(query).split(/\s+/).filter(Boolean)
  const matches = data.catalogs[kind].entries.filter(entry => terms.every(term => searchText(`${entry.code} ${entry.name}`).includes(term)))
  return {
    results: matches.slice((page - 1) * 25, page * 25),
    pagination: { page, page_size: 25, total_results: matches.length },
    retrievedAt: data.retrievedAt, source: data.catalogs[kind].source
  }
}
