import * as z from 'zod'
import { requireRole } from '../../../utils/auth'
import { getOrder } from '../../../utils/orders'
import { inventoryRequest, inventorySettings, inventoryAssert, assertOrderInventoryEditable, syncOrderInventory } from '../../../utils/inventory'

const schema = z.object({ requestId: z.uuid(), warehouseId: z.uuid(), version: z.number().int().positive() })
export default eventHandler(async (event) => {
  const user = await requireRole(event, ['admin', 'mostrador', 'vendedor'])
  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Selecciona un almacén válido.' })
  await getOrder(id, user)
  const input = parsed.data
  await inventoryRequest({ requestId: input.requestId, command: { action: 'orderWarehouse', id, ...input } }, user, async (tx) => {
    await tx.$queryRaw`SELECT id FROM sales_orders WHERE id = ${id}::uuid FOR UPDATE`
    await inventorySettings(tx)
    const order = await tx.salesOrder.findUniqueOrThrow({ where: { id }, include: { items: true } })
    inventoryAssert(order.inventoryManaged && order.version === input.version, 'El pedido cambió o no participa en inventario.')
    inventoryAssert((await tx.inventoryWarehouse.findUnique({ where: { id: input.warehouseId } }))?.active, 'Selecciona un almacén activo.')
    await assertOrderInventoryEditable(tx, id, order.items.map(i => ({ productId: i.productId, quantity: i.quantity.toString() })), input.warehouseId)
    await tx.salesOrder.update({ where: { id }, data: { warehouseId: input.warehouseId, version: { increment: 1 }, updatedByEmail: user.email } })
    await syncOrderInventory(tx, id, user)
    return { updated: true }
  })
  return getOrder(id, user)
})
