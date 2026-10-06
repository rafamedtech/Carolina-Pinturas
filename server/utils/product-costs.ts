import Decimal from 'decimal.js'
import { createError } from 'h3'
import { Prisma } from '../../generated/prisma/client'

/** Local acquisition costs, in the purchase currency, including taxes.
 * Receipt date determines recency; registration time and IDs break ties.
 * Use NO KEY UPDATE to remain compatible with receipt/inventory foreign-key locks.
 * Lock products in a stable order so concurrent receipts cannot leave stale costs.
 */
export async function refreshProductCosts(tx: Prisma.TransactionClient, productIds: string[], initial?: Array<{ productId: string, unitCost?: string, costCurrency?: string }>) {
  const ids = [...new Set(productIds)].sort()
  if (!ids.length) return
  await tx.$queryRaw(Prisma.sql`SELECT id FROM siigo_products WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR NO KEY UPDATE`)
  if (initial) {
    for (const line of initial) {
      if (!line.unitCost || !line.costCurrency || !new Decimal(line.unitCost).gt(0)) throw createError({ statusCode: 409, statusMessage: 'Captura el costo unitario y la moneda de cada producto del inventario inicial.' })
      const product = await tx.siigoProduct.findUniqueOrThrow({ where: { id: line.productId } })
      if (product.initialUnitCost !== null && (!product.initialUnitCost.equals(line.unitCost) || product.initialCostCurrency !== line.costCurrency)) throw createError({ statusCode: 409, statusMessage: `El costo inicial de ${product.code} ya está registrado. Usa el mismo costo y moneda en todos los almacenes.` })
      await tx.siigoProduct.update({ where: { id: line.productId }, data: { initialUnitCost: line.unitCost, initialCostCurrency: line.costCurrency } })
    }
  }
  await tx.$executeRaw(Prisma.sql`
    UPDATE siigo_products p SET unit_cost = COALESCE(latest.unit_cost, p.initial_unit_cost),
      cost_currency = COALESCE(latest.currency_code, p.initial_cost_currency)
    FROM (
      SELECT wanted.id, latest.unit_cost, latest.currency_code
      FROM siigo_products wanted
      LEFT JOIN LATERAL (
        SELECT i.unit_cost, o.currency_code
        FROM purchase_receipt_items ri
        JOIN purchase_receipts r ON r.id = ri.receipt_id
        JOIN purchase_items i ON i.id = ri.item_id
        JOIN purchase_orders o ON o.id = r.order_id
        WHERE i.product_id = wanted.id AND r.voided_at IS NULL
          AND o.status = 'confirmada' AND ri.quantity > 0
        ORDER BY r.date DESC, r.created_at DESC, r.id DESC, i.position DESC
        LIMIT 1
      ) latest ON true
      WHERE wanted.id IN (${Prisma.join(ids)})
    ) latest WHERE p.id = latest.id
  `)
}
