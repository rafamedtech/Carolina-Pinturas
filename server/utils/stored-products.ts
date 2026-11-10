import { createError } from 'h3'
import type { PrismaClient, Prisma } from '../../generated/prisma/client'
import type { ProductQuery } from '#shared/schemas/product'
import type { SiigoProduct } from '~/types/siigo'
import { filterProducts, normalizeSiigoProduct } from './siigo-products'

const productSelect = {
  id: true, code: true, name: true, type: true, active: true,
  unitCode: true, unitName: true, rawPayload: true
} satisfies Prisma.SiigoProductSelect

type StoredProduct = Prisma.SiigoProductGetPayload<{ select: typeof productSelect }>

// One catalog per database client/process, shared by prices, brands and order
// selectors. Check a small revision on EVERY read so other Vercel instances'
// writes invalidate it too. Never cache point reads used to save orders.
const catalogs = new WeakMap<PrismaClient, {
  revision: string
  expiresAt: number
  products: Promise<SiigoProduct[]>
}>()
const CATALOG_MAX_AGE_MS = 60_000

export function storedProductView(row: StoredProduct): SiigoProduct {
  const raw = row.rawPayload && typeof row.rawPayload === 'object' && !Array.isArray(row.rawPayload)
    ? row.rawPayload
    : {}
  const unit = typeof raw.unit === 'string'
    ? { code: raw.unit }
    : raw.unit && typeof raw.unit === 'object' && !Array.isArray(raw.unit) ? raw.unit : {}
  return normalizeSiigoProduct({
    ...raw, id: row.id, code: row.code, name: row.name,
    type: row.type ?? raw.type, active: row.active ?? raw.active,
    unit: { ...unit, code: unit.code || row.unitCode || undefined, name: unit.name || row.unitName || undefined }
  })
}

export async function getStoredProducts(db: PrismaClient, ids?: string[]) {
  if (ids && !ids.length) return []
  if (!ids) {
    const state = await db.siigoProduct.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })
    const revision = `${state._count._all}:${state._max.updatedAt?.toISOString() ?? ''}`
    let entry = catalogs.get(db)
    if (!entry || entry.revision !== revision || entry.expiresAt <= Date.now()) {
      entry = {
        revision,
        expiresAt: Date.now() + CATALOG_MAX_AGE_MS,
        products: readStoredProducts(db)
      }
      catalogs.set(db, entry)
    }
    try {
      // Callers must not mutate the shared snapshot (including nested prices).
      return structuredClone(await entry.products)
    } catch (error) {
      if (catalogs.get(db) === entry) catalogs.delete(db)
      throw error
    }
  }
  return readStoredProducts(db, ids)
}

async function readStoredProducts(db: PrismaClient, ids?: string[]) {
  const rows = await db.siigoProduct.findMany({
    where: ids ? { id: { in: [...new Set(ids)] } } : undefined,
    select: productSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }]
  })
  return rows.map(storedProductView)
}

export async function getStoredProduct(db: PrismaClient, id: string) {
  const row = await db.siigoProduct.findUnique({ where: { id }, select: productSelect })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'El producto no está en el catálogo local. Actualiza los productos para sincronizarlo desde Siigo.' })
  return storedProductView(row)
}

export async function listStoredProducts(db: PrismaClient, query: ProductQuery) {
  return filterProducts(await getStoredProducts(db, query.ids), query)
}
