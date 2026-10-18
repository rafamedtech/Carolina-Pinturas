import { createError } from 'h3'
import Decimal from 'decimal.js'
import { Prisma } from '../../generated/prisma/client'
import type { SiigoProduct } from '~/types/siigo'
import { inventoryRecipeSchema, type InventoryRecipe, type ProductComposition } from '#shared/schemas/product'

type Tx = Prisma.TransactionClient
const assert = (value: unknown, message: string) => {
  if (!value) throw createError({ statusCode: 409, statusMessage: message })
}
// Definitions, order snapshots and tracking changes share one lock order.
export async function lockCompositions(tx: Tx, exclusive = false) {
  if (exclusive) await tx.$queryRaw`SELECT pg_advisory_xact_lock(187645)::text`
  else await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(187645)::text`
}
export async function validateComposition(tx: Tx, input: ProductComposition, id?: string) {
  await lockCompositions(tx, true)
  const current = id ? await tx.siigoProduct.findUnique({ where: { id } }) : null
  if (id) assert(current && current.compositionVersion === input.version, 'El producto cambió. Recarga antes de guardar.')
  if (current && current.internalKind !== input.kind) {
    assert(!await tx.productComponent.count({ where: { componentId: id } }), 'El producto es componente de otros productos.')
    assert(!await tx.inventoryBalance.count({ where: { productId: id, OR: [{ quantity: { gt: 0 } }, { reserved: { gt: 0 } }] } }), 'El producto tiene existencias o reservas.')
    assert(!await tx.inventoryCountLine.count({ where: { productId: id, count: { status: { in: ['borrador', 'pendiente'] } } } }), 'El producto tiene conteos pendientes.')
    const purchases = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT i.id FROM purchase_items i JOIN purchase_orders o ON o.id = i.order_id
      WHERE i.product_id = ${id}::uuid AND (o.status = 'borrador' OR (o.status = 'confirmada' AND i.quantity > (
        SELECT COALESCE(SUM(ri.quantity), 0) FROM purchase_receipt_items ri JOIN purchase_receipts r ON r.id = ri.receipt_id
        WHERE ri.item_id = i.id AND r.voided_at IS NULL
      ))) LIMIT 1
    `)
    assert(!purchases.length, 'El producto tiene compras abiertas.')
    const dependencies = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT i.id FROM sales_order_items i JOIN sales_orders o ON o.id = i.order_id
      WHERE o.status_key NOT IN ('cancelado', 'entregado')
        AND (i.product_id = ${id}::uuid OR i.inventory_recipe @> ${JSON.stringify([{ productId: id }])}::jsonb)
      LIMIT 1
    `)
    assert(!dependencies.length, 'Hay pedidos abiertos que dependen de este producto.')
  }
  const ids = input.components.map(c => c.productId)
  assert(!id || !ids.includes(id), 'Un producto no puede incluirse a sí mismo.')
  if (!ids.length) return
  const components = await tx.siigoProduct.findMany({ where: { id: { in: ids } }, include: { inventoryProduct: true } })
  assert(components.length === ids.length, 'Algún componente no existe en el catálogo local.')
  assert(components.every(p => p.internalKind === 'product' && (!p.type || p.type === 'Product') && p.active !== false && p.inventoryProduct?.enabled), 'Todos los componentes deben ser productos simples, activos y con control de inventario interno.')
  await assertNoPendingProductWrites(tx, components)
}
export async function assertNoPendingProductWrites(tx: Tx, products: Array<{ id: string, code: string }>) {
  if (!products.length) return
  const pending = await tx.productWrite.count({ where: { state: { in: ['pending', 'unknown'] }, OR: [{ productId: { in: products.map(p => p.id) } }, { code: { in: products.map(p => p.code) } }] } })
  assert(!pending, 'Un producto tiene un guardado pendiente de conciliar. Revisa su resultado antes de utilizarlo.')
}
export async function attachProductCompositions(tx: Tx, products: SiigoProduct[]) {
  if (!products.length) return products
  const [definitions, writes] = await Promise.all([
    tx.siigoProduct.findMany({ where: { id: { in: products.map(p => p.id) } }, include: { inventoryProduct: true,
      inventoryBalances: { where: { warehouse: { active: true } }, select: { quantity: true, reserved: true } },
      internalComponents: { include: { component: { select: { code: true, name: true, unitName: true, unitCode: true } } } } } }),
    tx.productWrite.findMany({ where: { state: { in: ['pending', 'unknown'] }, OR: [{ productId: { in: products.map(p => p.id) } }, { code: { in: products.map(p => p.code) } }] }, select: { id: true, productId: true, code: true } })
  ])
  const byId = new Map(definitions.map(p => [p.id, p]))
  return products.map((p) => {
    const local = byId.get(p.id)
    return { ...p, internal: { ...p.internal,
      syncPending: writes.some(w => w.productId === p.id || w.code === p.code),
      pendingWriteId: writes.find(w => w.productId === p.id || w.code === p.code)?.id,
      inventory: local ? { tracked: local.internalKind === 'product' && Boolean(local.inventoryProduct?.enabled), available: local.internalKind === 'product' && local.inventoryProduct?.enabled ? local.inventoryBalances.reduce((sum, b) => sum.plus(b.quantity.toString()).minus(b.reserved.toString()), new Decimal(0)).toString() : null } : undefined,
      composition: { kind: local?.internalKind === 'composite' ? 'composite' as const : 'product' as const, version: local?.compositionVersion ?? 1,
        components: (local?.internalComponents ?? []).map(c => ({ productId: c.componentId, quantity: c.quantity.toString(), code: c.component.code, name: c.component.name, unit: c.component.unitName ?? c.component.unitCode })) }
    } }
  })
}
export async function captureInventoryRecipes(tx: Tx, ids: string[], previous: Array<{ productId: string, inventoryRecipe: Prisma.JsonValue | null }> = []) {
  await lockCompositions(tx)
  const products = await tx.siigoProduct.findMany({ where: { id: { in: ids } }, include: { internalComponents: { include: { component: { include: { inventoryProduct: true } } } } } })
  const byId = new Map(products.map(p => [p.id, p]))
  await assertNoPendingProductWrites(tx, products)
  const result = new Map<string, InventoryRecipe>()
  for (const id of ids) {
    const p = byId.get(id)
    assert(p, 'El producto no existe en el catálogo local.')
    const old = previous.find(i => i.productId === id)
    if (old?.inventoryRecipe) {
      result.set(id, inventoryRecipeSchema.parse(old.inventoryRecipe))
      continue
    }
    // A legacy order has no internal composition: preserve its original direct consumption.
    if (old || p!.internalKind === 'product') {
      result.set(id, [{ productId: id, quantity: '1', code: p!.code, name: p!.name, unit: p!.unitName ?? p!.unitCode }])
      continue
    }
    assert(p!.internalComponents.length, 'El producto compuesto no tiene componentes.')
    const components = p!.internalComponents
    assert(components.every(c => c.component.internalKind === 'product' && (!c.component.type || c.component.type === 'Product') && c.component.active !== false && c.component.inventoryProduct?.enabled), 'Revisa los componentes: deben ser productos simples, activos y con control interno.')
    await assertNoPendingProductWrites(tx, components.map(c => c.component))
    result.set(id, components.map(c => ({ productId: c.componentId, quantity: c.quantity.toString(), code: c.component.code, name: c.component.name, unit: c.component.unitName ?? c.component.unitCode })))
  }
  return result
}
