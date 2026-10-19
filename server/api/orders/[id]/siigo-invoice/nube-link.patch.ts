import * as z from 'zod'
import { ORDER_LOGISTICS_ROLES } from '~/utils/roleAccess'
import { siigoNubeInvoiceCode, siigoNubeInvoiceUrl } from '~~/shared/utils/siigoNube'
import { requireRole } from '../../../../utils/auth'
import { getOrder } from '../../../../utils/orders'
import { usePrisma } from '../../../../utils/prisma'

const schema = z.object({
  invoiceId: z.uuid(),
  url: z.string().max(2048).refine(value => siigoNubeInvoiceCode(value) !== null),
  confirmed: z.literal(true)
})

export default eventHandler(async (event) => {
  const user = await requireRole(event, ORDER_LOGISTICS_ROLES)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el identificador del pedido.' })
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Pega el enlace de la factura en Siigo Nube y confirma que corresponde a este pedido.' })
  }
  await getOrder(id, user)
  const code = siigoNubeInvoiceCode(parsed.data.url)!
  // La condición relacional evita guardar el enlace si otro usuario cambió
  // la factura asignada mientras el modal estaba abierto.
  const result = await usePrisma().salesOrderSiigoInvoice.updateMany({
    where: {
      orderId: id,
      status: 'created',
      siigoInvoiceId: parsed.data.invoiceId,
      order: { siigoReference: parsed.data.invoiceId }
    },
    data: { nubeInvoiceCode: code }
  })
  if (!result.count) {
    throw createError({ statusCode: 409, statusMessage: 'La factura asignada cambió. Actualiza el pedido e intenta nuevamente.' })
  }
  return { invoiceNubeCode: code, invoiceUrl: siigoNubeInvoiceUrl(code) }
})
