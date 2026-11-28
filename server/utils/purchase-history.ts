import Decimal from 'decimal.js'
import type { Prisma } from '../../generated/prisma/client'
import type { PurchaseHistoryFilters } from '#shared/schemas/purchase'
import type { PurchaseHistoryPage } from '#shared/types/purchase-history'
import { usePrisma } from './prisma'

const day = (date: Date) => date.toISOString().slice(0, 10)
const calendar = (value: string) => new Date(`${value}T00:00:00Z`)
// Borradores y canceladas no son compras: solo cuentan órdenes confirmadas (incluye liquidadas y vencidas).
const confirmedOrder = { status: 'confirmada' } satisfies Prisma.PurchaseOrderWhereInput
const newestFirst = [{ order: { date: 'desc' } }, { order: { folio: 'desc' } }] satisfies Prisma.PurchaseItemOrderByWithRelationInput[]

export function purchaseHistoryWhere(filters: PurchaseHistoryFilters): Prisma.PurchaseItemWhereInput {
  return {
    ...(filters.productId ? { productId: filters.productId } : {}),
    order: {
      ...confirmedOrder,
      ...(filters.providerId ? { providerId: filters.providerId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? { date: { ...(filters.dateFrom ? { gte: calendar(filters.dateFrom) } : {}), ...(filters.dateTo ? { lte: calendar(filters.dateTo) } : {}) } }
        : {})
    }
  }
}

/** Historial de compras por partida con su recepción y la última compra de cada producto (CVR-04). */
export async function listPurchaseHistory(filters: PurchaseHistoryFilters): Promise<PurchaseHistoryPage> {
  const db = usePrisma()
  const pageSize = filters.page_size
  const where = purchaseHistoryWhere(filters)
  const [rows, totalResults, products, providers] = await Promise.all([
    db.purchaseItem.findMany({
      where,
      orderBy: [...newestFirst, { position: 'asc' }],
      skip: (filters.page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, productId: true, code: true, name: true, quantity: true, unitCost: true, total: true,
        product: { select: { unitName: true, unitCode: true } },
        order: { select: { id: true, folio: true, date: true, providerId: true, providerName: true, currencyCode: true } },
        receipts: { where: { receipt: { voidedAt: null } }, select: { quantity: true } }
      }
    }),
    db.purchaseItem.count({ where }),
    filters.options
      ? db.purchaseItem.findMany({
          where: { order: confirmedOrder }, orderBy: [...newestFirst, { position: 'asc' }], distinct: ['productId'],
          select: { productId: true, code: true, name: true }
        })
      : [],
    filters.options
      ? db.purchaseOrder.findMany({
          where: confirmedOrder, orderBy: [{ date: 'desc' }, { folio: 'desc' }], distinct: ['providerId'],
          select: { providerId: true, providerName: true }
        })
      : []
  ])

  const productIds = [...new Set(rows.map(row => row.productId))]
  const latestItems = productIds.length
    ? await db.purchaseItem.findMany({
        where: { productId: { in: productIds }, order: confirmedOrder },
        orderBy: [...newestFirst, { position: 'asc' }],
        distinct: ['productId'],
        select: {
          id: true, productId: true, unitCost: true,
          order: { select: { id: true, folio: true, date: true, providerName: true, currencyCode: true } }
        }
      })
    : []
  const latestIds = new Set(latestItems.map(item => item.id))
  const latestItem = filters.productId ? latestItems.find(item => item.productId === filters.productId) : undefined

  return {
    results: rows.map((row) => {
      const received = row.receipts.reduce((sum, line) => sum.plus(line.quantity.toString()), new Decimal(0))
      const pending = Decimal.max(new Decimal(row.quantity.toString()).minus(received), 0)
      return {
        id: row.id, orderId: row.order.id, folio: row.order.folio, date: day(row.order.date),
        providerId: row.order.providerId, providerName: row.order.providerName,
        productId: row.productId, code: row.code, name: row.name, unit: row.product.unitName || row.product.unitCode || null,
        quantity: row.quantity.toString(), received: received.toString(), pending: pending.toString(),
        unitCost: row.unitCost.toString(), total: row.total.toString(), currencyCode: row.order.currencyCode,
        isLatest: latestIds.has(row.id)
      }
    }),
    latest: latestItem
      ? {
          orderId: latestItem.order.id, folio: latestItem.order.folio, date: day(latestItem.order.date),
          providerName: latestItem.order.providerName, unitCost: latestItem.unitCost.toString(), currencyCode: latestItem.order.currencyCode
        }
      : null,
    options: {
      products: products.map(product => ({ value: product.productId, label: product.name, code: product.code })),
      providers: providers.map(provider => ({ value: provider.providerId, label: provider.providerName }))
    },
    pagination: { page: filters.page, pageSize, totalResults, totalPages: Math.ceil(totalResults / pageSize) }
  }
}
