import { createError } from 'h3'
import type { PrismaClient } from '../../generated/prisma/client'
import type { SiigoProduct } from '~/types/siigo'
import { getProductDetail } from './siigo-products'
import { upsertSiigoProduct } from './siigo-persistence'

/** Explicit invoice validation: fresh Siigo reads, then refresh the local snapshots. */
export async function syncInvoiceProducts(db: PrismaClient, items: Array<{ productId: string, code: string }>) {
  const unique = [...new Map(items.map(item => [item.productId, item])).values()]
  const products: SiigoProduct[] = []
  // Bound remote concurrency even when an order has many lines.
  for (let offset = 0; offset < unique.length; offset += 4) {
    const batch = await Promise.all(unique.slice(offset, offset + 4).map(async (item) => {
      try {
        const product = await getProductDetail(item.productId, true)
        if (product.id !== item.productId) throw createError({ statusCode: 502, statusMessage: 'Siigo devolvió otro identificador de producto.' })
        await upsertSiigoProduct(db, product)
        if (product.active === false || (product.type && product.type !== 'Product') || product.code !== item.code) {
          throw createError({ statusCode: 409, statusMessage: `El producto ${item.code} cambió o ya no está activo en Siigo. Revisa el pedido antes de facturar.` })
        }
        return product
      } catch (error) {
        if ((error as { statusCode?: number }).statusCode === 404) {
          await db.siigoProduct.updateMany({ where: { id: item.productId }, data: { active: false } })
          throw createError({ statusCode: 409, statusMessage: `El producto ${item.code} ya no existe en Siigo. Revisa el pedido antes de facturar.` })
        }
        throw error
      }
    }))
    products.push(...batch)
  }
  return products
}
