import * as z from 'zod'
import type { SalesOrderDetail } from '~/types/orders'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import { usePrisma } from '../../../../utils/prisma'

const schema = z.object({
  version: z.number().int().positive(),
  confirmation: z.literal('QUITAR_FACTURA_ASIGNADA')
})

export default eventHandler(async (event): Promise<SalesOrderDetail> => {
  const user = await requireRole(event, ['admin'])
  const orderId = getRouterParam(event, 'id')
  if (!orderId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  }
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Confirma que deseas quitar la factura asignada.' })
  }
  const order = await getOrder(orderId, user)
  if (order.status.key === 'borrador') {
    throw createError({ statusCode: 409, statusMessage: 'La cotización no tiene una factura asignada.' })
  }

  await usePrisma().$transaction(async (tx) => {
    const reserved = await tx.salesOrder.updateMany({
      where: { id: orderId, version: parsed.data.version },
      data: { version: { increment: 1 } }
    })
    if (!reserved.count) {
      throw createError({ statusCode: 409, statusMessage: 'El pedido cambió. Actualiza e intenta nuevamente.' })
    }
    const invoice = await tx.salesOrderSiigoInvoice.findUnique({ where: { orderId } })
    if (invoice && ['pending', 'uncertain'].includes(invoice.status)) {
      throw createError({ statusCode: 409, statusMessage: 'Resuelve el intento de facturación pendiente antes de quitar la asociación.' })
    }
    await tx.salesOrderSiigoInvoice.deleteMany({ where: { orderId } })
    await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        siigoReference: null,
        registeredInSiigoAt: null,
        updatedByEmail: user.email
      }
    })
  })

  return getOrder(orderId, user)
})
