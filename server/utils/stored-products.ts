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
