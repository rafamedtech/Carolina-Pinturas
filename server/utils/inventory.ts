import { createHash } from 'node:crypto'
import Decimal from 'decimal.js'
import { createError } from 'h3'
import { Prisma } from '../../generated/prisma/client'
import type { AppUser } from '~/types/siigo'
import type { InventoryCommand, InventoryQuery } from '#shared/schemas/inventory'
import type { InventoryStock, OrderInventoryView } from '#shared/types/inventory'
import { mexicoToday } from '#shared/utils/datetime'
import { usePrisma } from './prisma'

type Tx = Prisma.TransactionClient
const countInclude = { warehouse: { select: { name: true } }, lines: { include: { product: { select: { code: true, name: true } } }, orderBy: { productId: 'asc' as const } } } satisfies Prisma.InventoryCountInclude
const countView = (count: Prisma.InventoryCountGetPayload<{ include: typeof countInclude }>) => ({ ...count, date: count.date.toISOString().slice(0, 10) })
const d = (v: Decimal.Value) => new Decimal(v)
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue
const date = (v: string) => new Date(`${v}T00:00:00Z`)
export function inventoryAssert(value: unknown, message: string): asserts value {
  if (!value) throw createError({ statusCode: 409, statusMessage: message })
}
export const INVENTORY_READ_ROLES = ['admin', 'mostrador', 'vendedor'] as const
export const INVENTORY_WRITE_ROLES = ['admin', 'mostrador'] as const
export async function inventorySettings(tx: Tx, exclusive = false) {
  if (exclusive) await tx.$queryRaw`SELECT id FROM inventory_settings WHERE id = 1 FOR UPDATE`
  else await tx.$queryRaw`SELECT id FROM inventory_settings WHERE id = 1 FOR SHARE`
  return tx.inventorySettings.findUniqueOrThrow({ where: { id: 1 } })
}
export async function lockInventoryBalances(tx: Tx, pairs: Array<{
  warehouseId: string
  productId: string }>) {
  const sorted = [...new Map(pairs.map(p => [`${p.warehouseId}:${p.productId}`, { warehouseId: p.warehouseId, productId: p.productId }])).values()].sort((a, b) => `${a.warehouseId}:${a.productId}`.localeCompare(`${b.warehouseId}:${b.productId}`))
  if (!sorted.length) return
  const warehouseIds = [...new Set(sorted.map(p => p.warehouseId))]
  inventoryAssert(await tx.inventoryWarehouse.count({ where: { id: { in: warehouseIds }, active: true } }) === warehouseIds.length, 'Selecciona un almacén activo.')
  await tx.inventoryBalance.createMany({ data: sorted, skipDuplicates: true })
  const keys = Prisma.join(sorted.map(p => Prisma.sql`(${p.warehouseId}::uuid, ${p.productId}::uuid)`))
  await tx.$queryRaw(Prisma.sql`SELECT b.product_id FROM inventory_balances b JOIN (VALUES ${keys}) AS wanted(warehouse_id, product_id) ON b.warehouse_id = wanted.warehouse_id AND b.product_id = wanted.product_id ORDER BY b.warehouse_id, b.product_id FOR UPDATE OF b`)
}
async function controlled(tx: Tx, productId: string) {
  const config = await tx.inventoryProduct.findUnique({ where: { productId } })
  inventoryAssert(config, 'El producto no existe en el catálogo local.')
  return config.enabled
}
interface Delta { warehouseId: string
  productId: string
  delta: Decimal.Value }
interface MovementInput { type: string, originKey: string, date: string, reason: string, orderId?: string, receiptId?: string, reversalOfId?: string, sourceMovementId?: string }
export async function postInventoryMovement(tx: Tx, input: MovementInput, deltas: Delta[], user: AppUser) {
  const grouped = new Map<string, Delta>()
  for (const line of deltas) {
    const key = `${line.warehouseId}:${line.productId}`
    const prior = grouped.get(key)
    grouped.set(key, { ...line, delta: d(prior?.delta ?? 0).plus(line.delta).toString() })
  }
  const entries = [...grouped.values()].filter(i => !d(i.delta).isZero()).sort((a, b) => `${a.warehouseId}:${a.productId}`.localeCompare(`${b.warehouseId}:${b.productId}`))
  if (!entries.length) return null
  await lockInventoryBalances(tx, entries)
  const balances = await tx.inventoryBalance.findMany({ where: { OR: entries.map(l => ({ warehouseId: l.warehouseId, productId: l.productId })) }, include: { product: true, warehouse: true } })
  const byKey = new Map(balances.map(b => [`${b.warehouseId}:${b.productId}`, b]))
  const lines = entries.map((line) => {
    const balance = byKey.get(`${line.warehouseId}:${line.productId}`)!
    const next = d(balance.quantity.toString()).plus(line.delta)
    inventoryAssert(next.lte('99999999999999.999999'), 'La existencia resultante supera el límite permitido.')
    inventoryAssert(next.gte(balance.reserved.toString()), `Existencias insuficientes para ${balance.product.code} en ${balance.warehouse.name}. Disponible: ${d(balance.quantity.toString()).minus(balance.reserved.toString())}.`)
    return { warehouseId: line.warehouseId, productId: line.productId, delta: d(line.delta).toString(), balanceAfter: next.toString(), productCode: balance.product.code, productName: balance.product.name, unitCode: balance.product.unitCode, unitName: balance.product.unitName, warehouseName: balance.warehouse.name }
  })
  const values = Prisma.join(lines.map(l => Prisma.sql`(${l.warehouseId}::uuid, ${l.productId}::uuid, ${l.balanceAfter}::numeric)`))
  await tx.$executeRaw(Prisma.sql`UPDATE inventory_balances b SET quantity = wanted.quantity, version = b.version + 1 FROM (VALUES ${values}) AS wanted(warehouse_id, product_id, quantity) WHERE b.warehouse_id = wanted.warehouse_id AND b.product_id = wanted.product_id`)
  const movement = await tx.inventoryMovement.create({ data: { ...input, date: date(input.date), actorId: user.id, actorName: user.name, actorEmail: user.email, actorRole: user.role } })
  await tx.inventoryMovementLine.createMany({ data: lines.map(l => ({ ...l, movementId: movement.id })) })
  return movement
}
export async function syncOrderInventory(tx: Tx, orderId: string, user: AppUser, previousStatus?: string) {
  await inventorySettings(tx)
  const order = await tx.salesOrder.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
  if (!order.inventoryManaged) return
  const dispatch = await tx.inventoryMovement.findUnique({ where: { originKey: `order:${orderId}:dispatch` } })
  if (dispatch) {
    inventoryAssert(!['borrador', 'ingresado', 'confirmado'].includes(order.statusKey), 'El pedido ya descontó inventario. Registra una devolución para regresar unidades.')
    inventoryAssert(previousStatus !== 'cancelado' || order.statusKey === 'cancelado', 'Un pedido cancelado después del surtido no puede reabrirse.')
    return
  }
  const outgoing = ['surtido', 'en_camino', 'entregado'].includes(order.statusKey)
  const prior = await tx.inventoryReservation.findMany({ where: { orderId } })
  const reserve = order.statusKey === 'confirmado' || (order.statusKey === 'en_espera' && prior.length > 0)
  const wanted = new Map<string, Decimal>()
  if (outgoing || reserve) {
    const configs = await tx.inventoryProduct.findMany({ where: { productId: { in: order.items.map(i => i.productId) }, enabled: true } })
    const ids = new Set(configs.map(p => p.productId))
    for (const item of order.items) if (ids.has(item.productId)) wanted.set(item.productId, (wanted.get(item.productId) ?? d(0)).plus(item.quantity.toString()))
    if (wanted.size) inventoryAssert(order.warehouseId, 'Selecciona el almacén del pedido antes de confirmar o surtir.')
  }
  const pairs = [...prior, ...[...wanted.keys()].map(productId => ({ productId, warehouseId: order.warehouseId! }))]
  await lockInventoryBalances(tx, pairs)
  if (prior.length) {
    const values = Prisma.join(prior.map(l => Prisma.sql`(${l.warehouseId}::uuid, ${l.productId}::uuid, ${l.quantity.toString()}::numeric)`))
    await tx.$executeRaw(Prisma.sql`UPDATE inventory_balances b SET reserved = b.reserved - wanted.quantity, version = b.version + 1 FROM (VALUES ${values}) AS wanted(warehouse_id, product_id, quantity) WHERE b.warehouse_id = wanted.warehouse_id AND b.product_id = wanted.product_id`)
  }
  await tx.inventoryReservation.deleteMany({ where: { orderId } })
  if (outgoing) {
    await postInventoryMovement(tx, { type: 'surtido', originKey: `order:${orderId}:dispatch`, date: mexicoToday(), reason: `Surtido del pedido ${order.folio}`, orderId }, [...wanted].map(([productId, q]) => ({ warehouseId: order.warehouseId!, productId, delta: q.negated().toString() })), user)
  } else if (reserve) {
    const balances = wanted.size ? await tx.inventoryBalance.findMany({ where: { warehouseId: order.warehouseId!, productId: { in: [...wanted.keys()] } }, include: { product: true } }) : []
    for (const balance of balances) {
      const q = wanted.get(balance.productId)!
      inventoryAssert(d(balance.quantity.toString()).minus(balance.reserved.toString()).gte(q), `No hay disponibilidad para reservar ${balance.product.code}.`)
    }
    if (wanted.size) {
      const values = Prisma.join([...wanted].map(([id, q]) => Prisma.sql`(${id}::uuid, ${q.toString()}::numeric)`))
      await tx.$executeRaw(Prisma.sql`UPDATE inventory_balances b SET reserved = b.reserved + wanted.quantity, version = b.version + 1 FROM (VALUES ${values}) AS wanted(product_id, quantity) WHERE b.warehouse_id = ${order.warehouseId}::uuid AND b.product_id = wanted.product_id`)
      await tx.inventoryReservation.createMany({ data: [...wanted].map(([productId, q]) => ({ warehouseId: order.warehouseId!, productId, orderId, quantity: q.toString() })) })
    }
  }
}
export async function assertOrderInventoryEditable(tx: Tx, orderId: string, lines: Array<{
  productId: string
  quantity: Decimal.Value }>, warehouseId?: string | null) {
  const order = await tx.salesOrder.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
  if (!order.inventoryManaged || !await tx.inventoryMovement.findUnique({ where: { originKey: `order:${orderId}:dispatch` } })) return
  const quantities = (items: typeof lines) => items.map(i => `${i.productId}:${d(i.quantity).toString()}`).sort()
  const before = quantities(order.items.map(i => ({ productId: i.productId, quantity: i.quantity.toString() })))
  const after = quantities(lines)
  inventoryAssert((warehouseId === undefined || warehouseId === order.warehouseId) && before.length === after.length && before.every((value, index) => value === after[index]), 'Productos, cantidades y almacén no se pueden modificar después del surtido.')
}
export async function receiveInventory(tx: Tx, receiptId: string, warehouseId: string | undefined, user: AppUser) {
  const settings = await inventorySettings(tx)
  if (!settings.enabledAt) return
  inventoryAssert(warehouseId, 'Selecciona el almacén destino de la recepción.')
  const warehouse = await tx.inventoryWarehouse.findUnique({ where: { id: warehouseId } })
  inventoryAssert(warehouse?.active, 'Selecciona un almacén activo.')
  const receipt = await tx.purchaseReceipt.findUniqueOrThrow({ where: { id: receiptId }, include: { items: { include: { item: true } } } })
  const configs = await tx.inventoryProduct.findMany({ where: { productId: { in: receipt.items.map(l => l.item.productId) }, enabled: true } })
  const ids = new Set(configs.map(p => p.productId))
  const deltas: Delta[] = []
  for (const line of receipt.items) if (ids.has(line.item.productId)) deltas.push({ warehouseId, productId: line.item.productId, delta: line.quantity.toString() })
  await tx.purchaseReceipt.update({ where: { id: receiptId }, data: { warehouseId } })
  await postInventoryMovement(tx, { type: 'recepcion', originKey: `receipt:${receiptId}`, date: receipt.date.toISOString().slice(0, 10), reason: 'Recepción de compra', receiptId }, deltas, user)
}
async function reverseMovement(tx: Tx, movementId: string, businessDate: string, reason: string, originKey: string, user: AppUser, automatic = false) {
  await tx.$queryRaw`SELECT id FROM inventory_movements WHERE id = ${movementId}::uuid FOR UPDATE`
  const original = await tx.inventoryMovement.findUnique({ where: { id: movementId }, include: { lines: true, reversal: true, returns: { include: { reversal: true } } } })
  inventoryAssert(original && !original.reversal && !original.reversalOfId, 'El movimiento no existe, ya fue revertido o es una reversión.')
  inventoryAssert(automatic || !['surtido', 'recepcion'].includes(original.type), 'Corrige el movimiento desde su documento de origen.')
  inventoryAssert(!original.returns.some(r => !r.reversal), 'Revierte primero las devoluciones vinculadas.')
  return postInventoryMovement(tx, { type: 'reversion', originKey, date: businessDate, reason, reversalOfId: original.id, orderId: original.orderId ?? undefined, receiptId: original.receiptId ?? undefined }, original.lines.map(l => ({ ...l, delta: d(l.delta.toString()).negated().toString() })), user)
}
export async function voidReceiptInventory(tx: Tx, receiptId: string, reason: string, user: AppUser) {
  await inventorySettings(tx)
  const movement = await tx.inventoryMovement.findUnique({ where: { originKey: `receipt:${receiptId}` } })
  if (movement) await reverseMovement(tx, movement.id, mexicoToday(), reason, `receipt:${receiptId}:void`, user, true)
}
async function returnMovement(tx: Tx, c: Extract<InventoryCommand['command'], {
  action: 'return' }>, originKey: string, user: AppUser) {
  await tx.$queryRaw`SELECT id FROM inventory_movements WHERE id = ${c.sourceMovementId}::uuid FOR UPDATE`
  const source = await tx.inventoryMovement.findUnique({ where: { id: c.sourceMovementId }, include: { lines: true, reversal: true, returns: { include: { lines: true, reversal: true } } } })
  inventoryAssert(source && ['surtido', 'recepcion'].includes(source.type) && !source.reversal, 'Selecciona un surtido o recepción vigente.')
  const customer = source.type === 'surtido'
  const deltas: Delta[] = []
  for (const line of c.lines) {
    const originals = source.lines.filter(l => l.productId === line.productId)
    const total = originals.reduce((s, l) => s.plus(d(l.delta.toString()).abs()), d(0))
    const returned = source.returns.filter(r => !r.reversal).flatMap(r => r.lines).filter(l => l.productId === line.productId).reduce((s, l) => s.plus(d(l.delta.toString()).abs()), d(0))
    inventoryAssert(total.gt(0) && total.minus(returned).gte(line.quantity), 'La devolución supera las unidades pendientes de devolver.')
    if (!customer) inventoryAssert(originals.every(l => l.warehouseId === c.warehouseId), 'Devuelve al proveedor desde el almacén de la recepción.')
    deltas.push({ warehouseId: c.warehouseId, productId: line.productId, delta: d(line.quantity).mul(customer ? 1 : -1).toString() })
  }
  return postInventoryMovement(tx, { type: customer ? 'devolucion_cliente' : 'devolucion_proveedor', originKey, date: c.date, reason: c.reason, sourceMovementId: source.id, orderId: source.orderId ?? undefined, receiptId: source.receiptId ?? undefined }, deltas, user)
}
async function mutate(tx: Tx, input: InventoryCommand, user: AppUser) {
  const c = input.command
  const admin = ['warehouse', 'tracking', 'minimum', 'activate', 'reverse', 'countApply'].includes(c.action) || (c.action === 'move' && c.type === 'inicial')
  if (admin && user.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Esta operación requiere administrador.' })
  if (!INVENTORY_WRITE_ROLES.includes(user.role as 'admin' | 'mostrador')) throw createError({ statusCode: 403, statusMessage: 'No tienes permiso para operar inventario.' })
  const settings = await inventorySettings(tx, ['warehouse', 'tracking', 'activate'].includes(c.action))
  if (c.action === 'warehouse') {
    const data = { code: c.code.toUpperCase(), name: c.name, address: c.address || null, active: c.active }
    if (c.id) {
      const old = await tx.inventoryWarehouse.findUnique({ where: { id: c.id } })
      inventoryAssert(old && old.version === c.version, 'El almacén cambió. Recarga antes de continuar.')
      if (!c.active) {
        const used = await tx.inventoryBalance.count({ where: { warehouseId: c.id, OR: [{ quantity: { gt: 0 } }, { reserved: { gt: 0 } }] } })
        const counts = await tx.inventoryCount.count({ where: { warehouseId: c.id, status: { in: ['borrador', 'pendiente'] } } })
        inventoryAssert(!used && !counts, 'El almacén tiene existencias, reservas o conteos pendientes.')
      }
      return tx.inventoryWarehouse.update({ where: { id: c.id }, data: { ...data, version: { increment: 1 } } })
    }
    const warehouse = await tx.inventoryWarehouse.create({ data })
    const products = await tx.inventoryProduct.findMany({ where: { enabled: true } })
    await tx.inventoryBalance.createMany({ data: products.map(p => ({ warehouseId: warehouse.id, productId: p.productId })) })
    return warehouse
  }
  if (c.action === 'activate') {
    inventoryAssert(settings.version === c.version && !settings.enabledAt, 'El inventario ya fue activado o cambió su configuración.')
    inventoryAssert(await tx.inventoryWarehouse.count({ where: { active: true } }), 'Crea al menos un almacén activo.')
    inventoryAssert(!await tx.inventoryCount.count({ where: { status: { in: ['borrador', 'pendiente'] } } }), 'Aplica o cancela los conteos pendientes antes de activar.')
    return tx.inventorySettings.update({ where: { id: 1 }, data: { enabledAt: new Date(), version: { increment: 1 } } })
  }
  if (c.action === 'tracking') {
    const old = await tx.inventoryProduct.findUnique({ where: { productId: c.productId } })
    inventoryAssert(old?.version === c.version, 'La configuración del producto cambió.')
    inventoryAssert(!await tx.inventoryBalance.count({ where: { productId: c.productId, OR: [{ quantity: { gt: 0 } }, { reserved: { gt: 0 } }] } }), 'El producto tiene existencias o reservas.')
    inventoryAssert(!await tx.inventoryCountLine.count({ where: { productId: c.productId, count: { status: { in: ['borrador', 'pendiente'] } } } }), 'El producto tiene conteos pendientes.')
    const result = await tx.inventoryProduct.update({ where: { productId: c.productId }, data: { enabled: c.enabled, version: { increment: 1 } } })
    if (c.enabled) {
      const warehouses = await tx.inventoryWarehouse.findMany({ where: { active: true } })
      await tx.inventoryBalance.createMany({ data: warehouses.map(w => ({ warehouseId: w.id, productId: c.productId })), skipDuplicates: true })
    }
    return result
  }
  if (c.action === 'minimum') {
    inventoryAssert(await controlled(tx, c.productId), 'El producto no tiene control interno habilitado.')
    await lockInventoryBalances(tx, [c])
    const changed = await tx.inventoryBalance.updateMany({ where: { warehouseId: c.warehouseId, productId: c.productId, version: c.version }, data: { minimum: c.minimum, version: { increment: 1 } } })
    inventoryAssert(changed.count, 'El saldo cambió. Recarga antes de continuar.')
    return { updated: true }
  }
  if (c.action === 'reverse') return reverseMovement(tx, c.movementId, c.date, c.reason, input.requestId, user)
  if (c.action === 'return') {
    inventoryAssert(settings.enabledAt, 'Activa el inventario antes de registrar devoluciones.')
    return returnMovement(tx, c, input.requestId, user)
  }
  if (c.action === 'move') {
    inventoryAssert(c.type === 'inicial' ? !settings.enabledAt : settings.enabledAt, c.type === 'inicial' ? 'El saldo inicial solo se carga antes de activar.' : 'Activa el inventario antes de operar movimientos.')
    if (c.type === 'traspaso') inventoryAssert(c.destinationId && c.destinationId !== c.warehouseId, 'Selecciona un almacén destino diferente.')
    if (c.type === 'inicial') await lockInventoryBalances(tx, c.lines.map(l => ({ warehouseId: c.warehouseId, productId: l.productId })))
    const deltas: Delta[] = []
    for (const l of c.lines) {
      inventoryAssert(await controlled(tx, l.productId), 'El producto no tiene control interno habilitado.')
      const product = await tx.siigoProduct.findUniqueOrThrow({ where: { id: l.productId } })
      inventoryAssert(product.active !== false, `Producto inactivo: ${product.code}.`)
      if (c.type === 'inicial') inventoryAssert(!await tx.inventoryMovementLine.findFirst({ where: { warehouseId: c.warehouseId, productId: l.productId } }), 'Este producto ya tiene historial en el almacén. Corrige el saldo mediante conteo.')
      deltas.push({ warehouseId: c.warehouseId, productId: l.productId, delta: d(l.quantity).mul(['salida', 'traspaso'].includes(c.type) ? -1 : 1).toString() })
      if (c.type === 'traspaso') deltas.push({ warehouseId: c.destinationId!, productId: l.productId, delta: l.quantity })
    }
    return postInventoryMovement(tx, { type: c.type, originKey: input.requestId, date: c.date, reason: c.reason }, deltas, user)
  }
  if (c.action === 'countCreate') {
    inventoryAssert((await tx.inventoryWarehouse.findUnique({ where: { id: c.warehouseId } }))?.active, 'Selecciona un almacén activo.')
    return countView(await tx.inventoryCount.create({ data: { warehouseId: c.warehouseId, date: date(c.date), reason: c.reason, createdBy: user.email }, include: countInclude }))
  }
  await tx.$queryRaw`SELECT id FROM inventory_counts WHERE id = ${c.id}::uuid FOR UPDATE`
  const count = await tx.inventoryCount.findUnique({ where: { id: c.id }, include: { lines: true } })
  inventoryAssert(count && count.version === c.version && ['borrador', 'pendiente'].includes(count.status), 'El conteo cambió o ya está cerrado.')
  if (c.action === 'countAdd' || c.action === 'countRemove') {
    inventoryAssert(count.status === 'borrador', 'Solo puedes cambiar productos en conteos en borrador.')
    if (c.action === 'countAdd') {
      inventoryAssert(!count.lines.some(l => l.productId === c.productId), 'El producto ya está incluido en este conteo.')
      inventoryAssert(await controlled(tx, c.productId), 'El producto no tiene control interno habilitado.')
      inventoryAssert((await tx.siigoProduct.findUniqueOrThrow({ where: { id: c.productId } })).active !== false, 'El producto está inactivo.')
      await lockInventoryBalances(tx, [{ warehouseId: count.warehouseId, productId: c.productId }])
      const balance = await tx.inventoryBalance.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId: count.warehouseId, productId: c.productId } } })
      await tx.inventoryCountLine.create({ data: { countId: c.id, productId: c.productId, baseVersion: balance.version, expected: balance.quantity } })
    } else {
      inventoryAssert(count.lines.some(l => l.productId === c.productId), 'El producto no pertenece al conteo.')
      await tx.inventoryCountLine.delete({ where: { countId_productId: { countId: c.id, productId: c.productId } } })
    }
  } else if (c.action === 'countEdit') {
    inventoryAssert(count.status === 'borrador', 'Solo puedes editar conteos en borrador.')
    inventoryAssert(new Set(c.lines.map(l => l.productId)).size === c.lines.length && c.lines.every(l => count.lines.some(i => i.productId === l.productId)), 'Partidas inválidas o repetidas.')
    for (const l of c.lines) await tx.inventoryCountLine.update({ where: { countId_productId: { countId: c.id, productId: l.productId } }, data: { counted: l.counted } })
  } else if (c.action === 'countRefresh') {
    await lockInventoryBalances(tx, count.lines.map(l => ({ warehouseId: count.warehouseId, productId: l.productId })))
    for (const l of count.lines) {
      const b = await tx.inventoryBalance.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId: count.warehouseId, productId: l.productId } } })
      if (b.version !== l.baseVersion) await tx.inventoryCountLine.update({ where: { countId_productId: { countId: c.id, productId: l.productId } }, data: { baseVersion: b.version, expected: b.quantity, counted: null } })
    }
  } else if (c.action === 'countSubmit') inventoryAssert(count.status === 'borrador' && count.lines.length > 0 && count.lines.every(l => l.counted !== null), 'Agrega productos y captura todas las cantidades antes de enviar.')
  else if (c.action === 'countApply') {
    inventoryAssert(count.status === 'pendiente', 'Envía el conteo antes de aprobarlo.')
    await lockInventoryBalances(tx, count.lines.map(l => ({ warehouseId: count.warehouseId, productId: l.productId })))
    const deltas: Delta[] = []
    for (const l of count.lines) {
      const b = await tx.inventoryBalance.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId: count.warehouseId, productId: l.productId } } })
      inventoryAssert(b.version === l.baseVersion && l.counted !== null, 'Hubo movimientos desde el conteo. Actualiza la base y vuelve a contar las partidas afectadas.')
      deltas.push({ warehouseId: count.warehouseId, productId: l.productId, delta: d(l.counted.toString()).minus(b.quantity.toString()).toString() })
    }
    const movement = await postInventoryMovement(tx, { type: settings.enabledAt ? 'ajuste' : 'inicial', originKey: `count:${c.id}`, date: count.date.toISOString().slice(0, 10), reason: count.reason }, deltas, user)
    await tx.inventoryCount.update({ where: { id: c.id }, data: { movementId: movement?.id } })
  }
  return countView(await tx.inventoryCount.update({ where: { id: c.id }, data: { version: { increment: 1 }, status: c.action === 'countApply' ? 'aplicado' : c.action === 'countCancel' ? 'cancelado' : c.action === 'countSubmit' ? 'pendiente' : 'borrador' }, include: countInclude }))
}
export async function inventoryRequest(input: {
  requestId: string
  command: unknown }, user: AppUser, mutation: (tx: Tx) => Promise<unknown>) {
  const requestHash = createHash('sha256').update(JSON.stringify({ actor: user.id, ...input })).digest('hex')
  return usePrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.requestId}, 0))::text`
    const prior = await tx.inventoryEvent.findUnique({ where: { requestId: input.requestId } })
    if (prior) {
      inventoryAssert(prior.requestHash === requestHash, 'Identificador de solicitud reutilizado con otros datos.')
      return prior.result
    }
    const result = json(await mutation(tx))
    await tx.inventoryEvent.create({ data: { requestId: input.requestId, requestHash, action: (input.command as { action?: string }).action ?? 'orderCreate', actorId: user.id, actorEmail: user.email, detail: json(input.command), result } })
    return result
  }, { timeout: 30000 })
}
export async function executeInventory(input: InventoryCommand, user: AppUser) {
  return inventoryRequest(input, user, tx => mutate(tx, input, user))
}
function pagination(q: InventoryQuery, total: number) {
  return { page: q.page, pageSize: q.page_size, totalResults: total, totalPages: Math.ceil(total / q.page_size) }
}
export function stockView(b: Prisma.InventoryBalanceGetPayload<{
  include: { product: true, warehouse: true } }>): InventoryStock {
  const available = d(b.quantity.toString()).minus(b.reserved.toString())
  return { productId: b.productId, warehouseId: b.warehouseId, code: b.product.code, name: b.product.name, unit: b.product.unitName ?? b.product.unitCode, warehouse: b.warehouse.name, quantity: b.quantity.toString(), reserved: b.reserved.toString(), available: available.toString(), minimum: b.minimum.toString(), low: available.lt(b.minimum.toString()), version: b.version }
}
export async function listInventory(resource: string, q: InventoryQuery) {
  const db = usePrisma()
  const skip = (q.page - 1) * q.page_size
  const productFilter = { ...(q.productId ? { id: q.productId } : {}), ...(q.search ? { OR: [{ code: { contains: q.search, mode: 'insensitive' as const } }, { name: { contains: q.search, mode: 'insensitive' as const } }] } : {}) }
  if (resource === 'settings') return db.inventorySettings.findUniqueOrThrow({ where: { id: 1 } })
  if (resource === 'warehouses') {
    const where: Prisma.InventoryWarehouseWhereInput = { ...(q.warehouseId ? { id: q.warehouseId } : {}), ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { code: { contains: q.search, mode: 'insensitive' } }] } : {}) }
    const [rows, total] = await Promise.all([db.inventoryWarehouse.findMany({ where, orderBy: { code: 'asc' }, skip, take: q.page_size }), db.inventoryWarehouse.count({ where })])
    return { results: rows, pagination: pagination(q, total) }
  }
  if (resource === 'products') {
    const where = { ...productFilter, ...(q.controlledOnly === 'true' ? { inventoryProduct: { enabled: true }, AND: [{ OR: [{ active: true }, { active: null }] }] } : {}) }
    const [rows, total] = await Promise.all([db.siigoProduct.findMany({ where, include: { inventoryProduct: true }, orderBy: [{ code: 'asc' }, { id: 'asc' }], skip, take: q.page_size }), db.siigoProduct.count({ where })])
    return { results: rows.map(p => ({ id: p.id, code: p.code, name: p.name, reference: p.reference ?? undefined, additional_fields: { barcode: p.barcode ?? undefined }, unit: p.unitName ?? p.unitCode, enabled: p.inventoryProduct?.enabled ?? false, version: p.inventoryProduct?.version ?? 1 })), pagination: pagination(q, total) }
  }
  if (resource === 'stocks') {
    const where = { ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}), ...(q.productId ? { productId: q.productId } : {}), product: { ...productFilter, inventoryProduct: { enabled: true } } }
    if (q.low === 'true') {
      const filter = Prisma.sql`FROM inventory_balances b JOIN siigo_products p ON p.id = b.product_id JOIN inventory_products c ON c.product_id = p.id WHERE c.enabled AND b.quantity - b.reserved < b.minimum AND (${q.warehouseId ?? null}::uuid IS NULL OR b.warehouse_id = ${q.warehouseId ?? null}::uuid) AND (${q.productId ?? null}::uuid IS NULL OR b.product_id = ${q.productId ?? null}::uuid) AND (p.code ILIKE ${'%' + q.search + '%'} OR p.name ILIKE ${'%' + q.search + '%'})`
      const ids = await db.$queryRaw<Array<{ warehouse_id: string, product_id: string }>>(Prisma.sql`SELECT b.warehouse_id, b.product_id ${filter} ORDER BY b.product_id, b.warehouse_id LIMIT ${q.page_size} OFFSET ${skip}`)
      const total = await db.$queryRaw<Array<{ total: number }>>(Prisma.sql`SELECT COUNT(*)::int AS total ${filter}`)
      const rows = ids.length ? await db.inventoryBalance.findMany({ where: { OR: ids.map(i => ({ warehouseId: i.warehouse_id, productId: i.product_id })) }, include: { product: true, warehouse: true }, orderBy: [{ productId: 'asc' }, { warehouseId: 'asc' }] }) : []
      return { results: rows.map(stockView), pagination: pagination(q, total[0]?.total ?? 0) }
    }
    const rows = await db.inventoryBalance.findMany({ where, include: { warehouse: true, product: true }, orderBy: [{ productId: 'asc' }, { warehouseId: 'asc' }], skip, take: q.page_size })
    return { results: rows.map(stockView), pagination: pagination(q, await db.inventoryBalance.count({ where })) }
  }
  if (resource === 'movements' || resource === 'kardex') {
    const where: Prisma.InventoryMovementWhereInput = { ...(q.type ? { type: q.type } : {}), ...(q.from || q.to ? { date: { ...(q.from ? { gte: date(q.from) } : {}), ...(q.to ? { lte: date(q.to) } : {}) } } : {}), ...(q.warehouseId || q.productId || q.search ? { lines: { some: { ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}), ...(q.productId ? { productId: q.productId } : {}), ...(q.search ? { OR: [{ productCode: { contains: q.search, mode: 'insensitive' } }, { productName: { contains: q.search, mode: 'insensitive' } }] } : {}) } } } : {}) }
    const [rows, total] = await Promise.all([db.inventoryMovement.findMany({ where, include: { lines: { where: { ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}), ...(q.productId ? { productId: q.productId } : {}) } }, reversal: { select: { id: true } } }, orderBy: { folio: 'desc' }, skip, take: q.page_size }), db.inventoryMovement.count({ where })])
    return { results: rows.map(r => ({ ...r, date: r.date.toISOString().slice(0, 10) })), pagination: pagination(q, total) }
  }
  if (resource === 'counts') {
    const where = { ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}), ...(q.from || q.to ? { date: { ...(q.from ? { gte: date(q.from) } : {}), ...(q.to ? { lte: date(q.to) } : {}) } } : {}), ...(q.search ? { reason: { contains: q.search, mode: 'insensitive' as const } } : {}) }
    const [rows, total] = await Promise.all([db.inventoryCount.findMany({ where, include: { warehouse: { select: { name: true } }, lines: { include: { product: { select: { code: true, name: true } } }, orderBy: { productId: 'asc' } } }, orderBy: { createdAt: 'desc' }, skip, take: q.page_size }), db.inventoryCount.count({ where })])
    return { results: rows.map(r => ({ ...r, date: r.date.toISOString().slice(0, 10) })), pagination: pagination(q, total) }
  }
  if (resource === 'reservations') {
    const where = { ...(q.warehouseId ? { warehouseId: q.warehouseId } : {}), ...(q.productId ? { productId: q.productId } : {}), product: productFilter }
    const [rows, total] = await Promise.all([db.inventoryReservation.findMany({ where, include: { order: { select: { folio: true } }, product: { select: { code: true, name: true } }, warehouse: { select: { name: true } } }, skip, take: q.page_size, orderBy: { orderId: 'asc' } }), db.inventoryReservation.count({ where })])
    return { results: rows, pagination: pagination(q, total) }
  }
  throw createError({ statusCode: 404, statusMessage: 'Recurso de inventario no encontrado.' })
}
export async function orderInventoryView(id: string): Promise<OrderInventoryView> {
  const db = usePrisma()
  const order = await db.salesOrder.findUniqueOrThrow({ where: { id }, include: { items: { select: { productId: true } } } })
  const movements = await db.inventoryMovement.findMany({ where: { orderId: id }, select: { id: true, folio: true, type: true }, orderBy: { folio: 'asc' } })
  const stocks = order.warehouseId ? await db.inventoryBalance.findMany({ where: { warehouseId: order.warehouseId, productId: { in: order.items.map(i => i.productId) } }, include: { product: true, warehouse: true } }) : []
  return { managed: order.inventoryManaged, warehouseId: order.warehouseId, dispatched: movements.some(m => m.type === 'surtido'), movements, stocks: stocks.map(stockView) }
}
